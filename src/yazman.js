const { ChatOllama } = require('@langchain/community/chat_models/ollama');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

class RestaurantManager {
    constructor() {
        this.model = new ChatOllama({
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            model: process.env.OLLAMA_MODEL || "gemma3:1b",
            temperature: 0.7,
        });

        // CSV dosyalarından veri yükle
        this.dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
        this.tables = this.loadTablesFromCsv();
        this.drinks = this.loadSimpleListCsv('drinks.csv');
        this.soups = this.loadSimpleListCsv('soups.csv');
        this.mains = this.loadSimpleListCsv('mains.csv');
        this.salads = this.loadSimpleListCsv('salads.csv');
        this.stocks = this.loadStocksCsv();
        this.weeklyMenus = this.loadWeeklyMenusCsv(); // dow -> { soup:[], main:[], salad:[], drink:[] }
        this.weeklyOccupancy = this.loadWeeklyOccupancyCsv(); // dow -> time -> Set(table)

        // Rezervasyonlar - tarih -> saat -> masa numarası
        this.reservations = {};
        this.loadReservationsFromCsv();

        // kayıtlar.csv'den durum (masa doluluk) ve stok bilgisi
        this.tableStatus = {}; // date -> time -> Set(table_number)
        this.stockByItem = {}; // item(lowercase) -> quantity (number) veya tarih bazlı genişletilebilir
        this.loadKayitlarCsv();

        // Çalışma saatleri
        this.workingHours = {
            "pazartesi": { open: "11:00", close: "23:00" },
            "salı": { open: "11:00", close: "23:00" },
            "çarşamba": { open: "11:00", close: "23:00" },
            "perşembe": { open: "11:00", close: "23:00" },
            "cuma": { open: "11:00", close: "24:00" },
            "cumartesi": { open: "11:00", close: "24:00" },
            "pazar": { open: "11:00", close: "23:00" }
        };

        // Rezervasyon kabul edilen tarih aralığı
        this.allowedStartDate = new Date('2025-10-24');
        this.allowedEndDate = new Date('2025-12-31');
    }

    // CSV yükleyiciler
    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    loadTablesFromCsv() {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, 'tables.csv');
        if (!fs.existsSync(filePath)) {
            // 20 masa, her biri 4 kişilik, varsayılan konum
            const header = 'table_number,capacity,location\n';
            let content = header;
            for (let i = 1; i <= 20; i++) {
                content += `${i},4,Salon\n`;
            }
            fs.writeFileSync(filePath, content, 'utf8');
        }
        const csv = fs.readFileSync(filePath, 'utf8');
        const records = parse(csv, { columns: true, skip_empty_lines: true });
        const tablesMap = {};
        for (const row of records) {
            const num = parseInt(row.table_number);
            tablesMap[num] = { capacity: parseInt(row.capacity), location: row.location };
        }
        return tablesMap;
    }

    loadSimpleListCsv(filename) {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, filename);
        if (!fs.existsSync(filePath)) {
            // Defaults
            let defaults = [];
            if (filename === 'drinks.csv') {
                defaults = ['Ayran', 'Kola', 'Su', 'Şalgam', 'Çay'];
            } else if (filename === 'soups.csv') {
                defaults = ['Mercimek Çorbası', 'Yayla Çorbası', 'Ezogelin Çorbası', 'Domates Çorbası', 'Tarhana Çorbası', 'Mantar Çorbası', 'Tavuk Çorbası', 'Brokoli Çorbası'];
            } else if (filename === 'mains.csv') {
                defaults = ['Adana Kebap', 'Urfa Kebap', 'Kuzu Tandır', 'Kuzu Pirzola', 'Tavuk Şinitzel', 'Tavuk Sote', 'Balık Izgara', 'Balık Buğulama', 'Köfte', 'Mantı', 'Lahmacun', 'İçli Köfte', 'Pide', 'Et Sote', 'Sebzeli Güveç', 'Fırın Tavuk'];
            } else if (filename === 'salads.csv') {
                defaults = ['Çoban Salata', 'Mevsim Salata', 'Roka Salata', 'Piyaz', 'Cevizli Salata', 'Gavurdağı Salatası'];
            }
            const header = 'name\n';
            const content = header + defaults.map(n => `${n}`).join('\n') + '\n';
            fs.writeFileSync(filePath, content, 'utf8');
        }
        const csv = fs.readFileSync(filePath, 'utf8');
        const lines = csv.split(/\r?\n/).filter(Boolean);
        const names = lines.slice(1); // skip header
        return names;
    }

    loadReservationsFromCsv() {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, 'reservations.csv');
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, 'date,time,table_number,customer_name,party_size,special_requests\n', 'utf8');
            return;
        }
        const csv = fs.readFileSync(filePath, 'utf8');
        const records = parse(csv, { columns: true, skip_empty_lines: true });
        for (const row of records) {
            const dateKey = row.date;
            const timeKey = row.time;
            const tableNum = parseInt(row.table_number);
            if (!this.reservations[dateKey]) this.reservations[dateKey] = {};
            if (!this.reservations[dateKey][timeKey]) this.reservations[dateKey][timeKey] = [];
            if (!this.reservations[dateKey][timeKey].includes(tableNum)) {
                this.reservations[dateKey][timeKey].push(tableNum);
            }
        }
    }

    loadStocksCsv() {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, 'stocks.csv');
        if (!fs.existsSync(filePath)) {
            const defaults = ['Ayran,50', 'Kola,40', 'Su,200', 'Şalgam,15', 'Çay,100'];
            fs.writeFileSync(filePath, 'item,quantity\n' + defaults.join('\n') + '\n', 'utf8');
        }
        const out = {};
        const csv = fs.readFileSync(filePath, 'utf8');
        const lines = csv.split(/\r?\n/).filter(Boolean);
        for (const line of lines.slice(1)) {
            const [item, qtyStr] = line.split(',');
            const key = (item || '').trim().toLowerCase();
            const qty = parseInt((qtyStr || '0').trim());
            if (key) out[key] = Number.isFinite(qty) ? qty : 0;
        }
        return out;
    }

    loadWeeklyMenusCsv() {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, 'weekly_menus.csv');
        const map = {};
        if (!fs.existsSync(filePath)) return map;
        const csv = fs.readFileSync(filePath, 'utf8');
        const records = parse(csv, { columns: true, skip_empty_lines: true });
        records.forEach(r => {
            const dow = String(r.dow).trim();
            const cat = (r.category || '').trim().toLowerCase();
            const item = (r.item || '').trim();
            if (!map[dow]) map[dow] = { soup: [], main: [], salad: [], drink: [] };
            if (['soup','main','salad','drink'].includes(cat) && item) {
                map[dow][cat].push(item);
            }
        });
        return map;
    }

    loadWeeklyOccupancyCsv() {
        this.ensureDataDir();
        const filePath = path.join(this.dataDir, 'weekly_occupancy.csv');
        const map = {};
        if (!fs.existsSync(filePath)) return map;
        const csv = fs.readFileSync(filePath, 'utf8');
        const records = parse(csv, { columns: true, skip_empty_lines: true });
        records.forEach(r => {
            const dow = String(r.dow).trim();
            const time = (r.time || '').trim();
            const tableNum = parseInt(r.table_number);
            const status = (r.status || '').toLowerCase();
            if (!dow || !time || !Number.isInteger(tableNum)) return;
            if (!map[dow]) map[dow] = {};
            if (!map[dow][time]) map[dow][time] = new Set();
            if (status === 'dolu' || status === 'occupied') map[dow][time].add(tableNum);
        });
        return map;
    }

    // kayıtlar.csv yükle: masa doluluk ve stok bilgilerini okur
    loadKayitlarCsv() {
        try {
            const kayitlarPath = path.join(__dirname, '..', '..', 'kayıtlar.csv');
            if (!fs.existsSync(kayitlarPath)) {
                return;
            }
            const csv = fs.readFileSync(kayitlarPath, 'utf8');
            const lines = csv.split(/\r?\n/).filter(Boolean);
            // Beklenen kolonlar: type,date,time,table_number,status,item,quantity
            // Eski formatları görmezden geliyoruz (başlık uyuşmazsa atla)
            const header = lines[0].toLowerCase();
            if (!(header.includes('type') || header.includes('tip'))) {
                return; // eski reçete formatı, kullanmıyoruz
            }
            const rows = lines.slice(1).map(l => l.split(','));
            rows.forEach(cols => {
                const [type, date, time, tableStr, status, item, qtyStr] = cols.map(c => (c || '').trim());
                if ((type || '').toLowerCase() === 'table') {
                    const dateKey = date;
                    const timeKey = time;
                    const tableNumber = parseInt(tableStr);
                    const isOccupied = (status || '').toLowerCase() === 'dolu' || (status || '').toLowerCase() === 'occupied';
                    if (!dateKey || !timeKey || !Number.isInteger(tableNumber)) return;
                    if (isOccupied) {
                        if (!this.tableStatus[dateKey]) this.tableStatus[dateKey] = {};
                        if (!this.tableStatus[dateKey][timeKey]) this.tableStatus[dateKey][timeKey] = new Set();
                        this.tableStatus[dateKey][timeKey].add(tableNumber);
                    }
                } else if ((type || '').toLowerCase() === 'stock') {
                    const key = (item || '').toLowerCase();
                    if (!key) return;
                    const qty = parseInt(qtyStr);
                    this.stockByItem[key] = Number.isFinite(qty) ? qty : 0;
                }
            });
        } catch (err) {
            console.error('kayıtlar.csv yükleme hatası:', err);
        }
    }

    // Tarihi gün adına çevir
    getDayName(dateString) {
        const date = new Date(dateString);
        const days = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
        return days[date.getDay()];
    }

    // Belirli tarih ve saatte müsait masaları bul
    getAvailableTables(date, time, partySize) {
        // Tarih aralığı kontrolü
        const d = new Date(date);
        if (isNaN(d.getTime()) || d < this.allowedStartDate || d > this.allowedEndDate) {
            return { available: false, message: `Rezervasyonlar sadece 2025-10-24 ile 2025-12-31 tarihleri arasında yapılabilir.` };
        }
        const dayName = this.getDayName(date);
        
        // Çalışma saatleri kontrolü
        const workingHours = this.workingHours[dayName];
        if (!workingHours) {
            return { available: false, message: "Bu gün restoran kapalı." };
        }

        const requestedTime = time.split(':');
        const openTime = workingHours.open.split(':');
        const closeTime = workingHours.close.split(':');
        
        const requestedMinutes = parseInt(requestedTime[0]) * 60 + parseInt(requestedTime[1]);
        const openMinutes = parseInt(openTime[0]) * 60 + parseInt(openTime[1]);
        const closeMinutes = parseInt(closeTime[0]) * 60 + parseInt(closeTime[1]);

        if (requestedMinutes < openMinutes || requestedMinutes >= closeMinutes) {
            return { 
                available: false, 
                message: `Bu gün çalışma saatleri: ${workingHours.open} - ${workingHours.close}` 
            };
        }

        // Rezervasyon kontrolü
        const dateKey = date;
        const timeKey = time;
        
        if (!this.reservations[dateKey]) {
            this.reservations[dateKey] = {};
        }
        if (!this.reservations[dateKey][timeKey]) {
            this.reservations[dateKey][timeKey] = [];
        }

        const reservedTables = this.reservations[dateKey][timeKey];
        const occupiedByKayitlar = (this.tableStatus[dateKey] && this.tableStatus[dateKey][timeKey]) ? this.tableStatus[dateKey][timeKey] : new Set();
        // Haftalık doluluk (tekrar eden) uygulanır
        const dowIndex = new Date(date).getDay();
        const weekly = (this.weeklyOccupancy[String(dowIndex)] && this.weeklyOccupancy[String(dowIndex)][time]) ? this.weeklyOccupancy[String(dowIndex)][time] : new Set();
        const availableTables = [];

        for (const [tableNumber, tableInfo] of Object.entries(this.tables)) {
            const num = parseInt(tableNumber);
            if (tableInfo.capacity >= partySize && !reservedTables.includes(num) && !occupiedByKayitlar.has(num) && !weekly.has(num)) {
                availableTables.push({
                    number: num,
                    capacity: tableInfo.capacity,
                    location: tableInfo.location
                });
            }
        }

        return {
            available: availableTables.length > 0,
            tables: availableTables,
            message: availableTables.length > 0 ? 
                `${availableTables.length} müsait masa bulundu.` : 
                "Bu saatte müsait masa bulunmuyor."
        };
    }

    // Rezervasyon yap
    makeReservation(date, time, tableNumber, customerName, partySize, specialRequests = "Yok", userId = null) {
        // Tarih aralığı kontrolü
        const d = new Date(date);
        if (isNaN(d.getTime()) || d < this.allowedStartDate || d > this.allowedEndDate) {
            return { success: false, message: `Rezervasyonlar sadece 2025-10-24 ile 2025-12-31 tarihleri arasında yapılabilir.` };
        }
        const dateKey = date;
        const timeKey = time;
        
        if (!this.reservations[dateKey]) {
            this.reservations[dateKey] = {};
        }
        if (!this.reservations[dateKey][timeKey]) {
            this.reservations[dateKey][timeKey] = [];
        }

        // Masa müsait mi kontrol et
        if (this.reservations[dateKey][timeKey].includes(tableNumber)) {
            return { success: false, message: "Bu masa zaten rezerve edilmiş." };
        }

        // Rezervasyonu kaydet
        this.reservations[dateKey][timeKey].push(tableNumber);
        
        const reservation = {
            date: date,
            time: time,
            tableNumber: tableNumber,
            customerName: customerName,
            partySize: partySize,
            specialRequests: specialRequests,
            userId: userId,
            createdAt: new Date().toISOString()
        };

        // CSV'ye ekle
        try {
            this.ensureDataDir();
            const filePath = path.join(this.dataDir, 'reservations.csv');
            const line = `\n${reservation.date},${reservation.time},${reservation.tableNumber},${reservation.customerName.replace(/,/g, ' ')},${reservation.partySize},${(reservation.specialRequests || '').toString().replace(/,/g, ' ')},${userId || ''}`;
            fs.appendFileSync(filePath, line, 'utf8');
        } catch (err) {
            // CSV yazımı başarısız olsa da hafıza içi rezervasyon devam eder
            console.error('Rezervasyon CSV yazma hatası:', err);
        }

        return { 
            success: true, 
            message: "Rezervasyon başarıyla oluşturuldu.",
            reservation: reservation
        };
    }

    // Günlük menüyü getir
    getDailyMenu(date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return { available: false, message: "Geçersiz tarih." };
        }
        // Deterministic rotation based on day offset
        const base = new Date('2025-10-24');
        const dayIndex = Math.floor((d - base) / (1000 * 60 * 60 * 24));

        const pickRotating = (arr, count, offset) => {
            const result = [];
            for (let i = 0; i < Math.min(count, arr.length); i++) {
                const idx = (offset + i) % arr.length;
                result.push(arr[idx]);
            }
            return result;
        };

        const soups = pickRotating(this.soups, 4, (dayIndex * 3) % this.soups.length);
        const mains = pickRotating(this.mains, 4, (dayIndex * 5) % this.mains.length);
        const salads = pickRotating(this.salads, 2, (dayIndex * 2) % this.salads.length);
        // Stok kontrolü: stok 0 ise listeden çıkar
        const inStock = (name) => {
            // Öncelik: stocks.csv (this.stocks), sonra kayıtlar.csv (this.stockByItem)
            const key = (name || '').toLowerCase();
            if (this.stocks && Object.prototype.hasOwnProperty.call(this.stocks, key)) {
                return (this.stocks[key] || 0) > 0;
            }
            if (this.stockByItem && Object.prototype.hasOwnProperty.call(this.stockByItem, key)) {
                return (this.stockByItem[key] || 0) > 0;
            }
            return true;
        };

        // Haftalık menü öncelikli
        const dowIndex = d.getDay();
        const weekly = this.weeklyMenus[String(dowIndex)] || { soup: [], main: [], salad: [], drink: [] };
        const soupsList = weekly.soup.length ? weekly.soup : soups;
        const mainsList = weekly.main.length ? weekly.main : mains;
        const saladsList = weekly.salad.length ? weekly.salad : salads;
        const drinksList = weekly.drink.length ? weekly.drink : this.drinks;

        const soupsAvail = soupsList.filter(inStock).slice(0, 4);
        const mainsAvail = mainsList.filter(inStock).slice(0, 4);
        const saladsAvail = saladsList.filter(inStock).slice(0, 2);
        const drinksAvail = drinksList.filter(inStock).slice(0, 5);

        const dayName = this.getDayName(date);
        let menuText = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} (${date}) Menüsü:\n\n`;
        const sections = [
            ['Çorbalar', soupsAvail],
            ['Ana Yemekler', mainsAvail],
            ['Salatalar', saladsAvail],
            ['İçecekler', drinksAvail]
        ];
        for (const [title, items] of sections) {
            menuText += `${title}:\n`;
            items.forEach(item => {
                menuText += `• ${item}\n`;
            });
            menuText += "\n";
        }
        return { available: true, menu: menuText };
    }

    // Stok güncelle ve dosyaya yaz
    setStock(itemName, quantity) {
        const key = (itemName || '').toLowerCase();
        if (!key) return { success: false, message: 'Geçersiz ürün adı' };
        const qtyNum = parseInt(quantity);
        if (!Number.isFinite(qtyNum) || qtyNum < 0) return { success: false, message: 'Geçersiz miktar' };
        this.stocks[key] = qtyNum;
        try {
            this.ensureDataDir();
            const filePath = path.join(this.dataDir, 'stocks.csv');
            // Write all stocks sorted by name
            const entries = Object.entries(this.stocks).sort((a,b) => a[0].localeCompare(b[0]));
            const lines = ['item,quantity'].concat(entries.map(([k,v]) => `${k.replace(/(^.|\s.)./g, s=>s)} ,${v}`));
            // Above replace would be messy; simpler: keep original casing if available is not tracked; write capitalized first letter
            const lines2 = ['item,quantity'];
            entries.forEach(([k,v]) => {
                const nice = k.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
                lines2.push(`${nice},${v}`);
            });
            fs.writeFileSync(filePath, lines2.join('\n') + '\n', 'utf8');
            return { success: true, message: 'Stok güncellendi' };
        } catch (err) {
            console.error('stocks.csv yazma hatası:', err);
            return { success: false, message: 'Stok yazımı başarısız' };
        }
    }

    // Stok düşür (kullanım halinde azalt)
    decrementStock(itemName, quantity = 1) {
        const key = (itemName || '').toLowerCase();
        if (!key) return { success: false, message: 'Geçersiz ürün adı' };
        const current = this.stocks[key] ?? 0;
        const next = Math.max(0, current - Math.max(1, parseInt(quantity)));
        return this.setStock(itemName, next);
    }

    // Cancel persist: reservations.csv dosyasından çıkart
    persistCancel(date, time, tableNumber) {
        try {
            this.ensureDataDir();
            const filePath = path.join(this.dataDir, 'reservations.csv');
            if (!fs.existsSync(filePath)) return;
            const csv = fs.readFileSync(filePath, 'utf8');
            const lines = csv.split(/\r?\n/);
            const header = lines.shift();
            const kept = lines.filter(line => {
                if (!line.trim()) return false;
                const [d,t,tn] = line.split(',');
                return !(d === date && t === time && parseInt(tn) === tableNumber);
            });
            fs.writeFileSync(filePath, header + '\n' + kept.join('\n') + (kept.length?'\n':'') , 'utf8');
        } catch (err) {
            console.error('Rezervasyon iptal persist hatası:', err);
        }
    }

    // Rezervasyon özeti oluştur
    generateReservationSummary(reservation) {
        const dayName = this.getDayName(reservation.date);
        const menu = this.getDailyMenu(reservation.date);
        const tableInfo = this.tables[reservation.tableNumber];

        let summary = `🍽️ REZERVASYON ÖZETİ\n\n`;
        summary += `👤 Müşteri: ${reservation.customerName}\n`;
        summary += `📅 Tarih: ${reservation.date} (${dayName})\n`;
        summary += `🕐 Saat: ${reservation.time}\n`;
        summary += `👥 Kişi Sayısı: ${reservation.partySize}\n`;
        summary += `🪑 Masa: ${reservation.tableNumber} (${tableInfo.capacity} kişilik, ${tableInfo.location})\n`;
        summary += `📝 Özel İstekler: ${reservation.specialRequests}\n\n`;

        if (menu.available) {
            summary += `📋 O Günkü Menü:\n${menu.menu}`;
        }

        return summary;
    }

    // AI ile rezervasyon onayı
    async confirmReservationWithAI(reservationData) {
        try {
            const prompt = `Sen bir restoran rezervasyon asistanısın. Aşağıdaki rezervasyon bilgilerini kontrol et ve onayla:

${reservationData}

Bu rezervasyonu onaylıyor musun? Eğer onaylıyorsan "EVET" de, onaylamıyorsan nedenini açıkla.`;

            const response = await this.model.invoke(prompt);
            return response.content;
        } catch (error) {
            console.error('AI onay hatası:', error);
            return "Rezervasyon onayı sırasında bir hata oluştu.";
        }
    }

    // Rezervasyon iptal et (user ID kontrolü ile)
    cancelReservation(date, time, tableNumber, userId = null) {
        const dateKey = date;
        const timeKey = time;
        
        if (!this.reservations[dateKey] || !this.reservations[dateKey][timeKey]) {
            return { success: false, message: "Rezervasyon bulunamadı." };
        }

        const tableIndex = this.reservations[dateKey][timeKey].indexOf(tableNumber);
        if (tableIndex === -1) {
            return { success: false, message: "Bu masa rezerve edilmemiş." };
        }

        // User ID kontrolü - CSV'den kontrol et
        if (userId) {
            const fs = require('fs');
            const filePath = path.join(this.dataDir, 'reservations.csv');
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const reservationLine = lines.find(line => {
                    const [d, t, tn, name, party, special, uid] = line.split(',');
                    return d === date && t === time && parseInt(tn) === tableNumber;
                });
                
                if (reservationLine) {
                    const parts = reservationLine.split(',');
                    const reservationUserId = parts[6] || '';
                    if (reservationUserId !== userId.toString()) {
                        return { success: false, message: "Bu rezervasyonu iptal etme yetkiniz yok." };
                    }
                }
            }
        }

        this.reservations[dateKey][timeKey].splice(tableIndex, 1);
        this.persistCancel(date, time, tableNumber);
        return { success: true, message: "Rezervasyon iptal edildi." };
    }

    // Kullanıcının rezervasyonlarını getir
    getUserReservations(userId) {
        const fs = require('fs');
        const filePath = path.join(this.dataDir, 'reservations.csv');
        
        if (!fs.existsSync(filePath)) {
            return { success: true, message: "Henüz rezervasyonunuz yok." };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').slice(1); // Skip header
        const userReservations = lines.filter(line => {
            const parts = line.split(',');
            return parts[6] === userId.toString();
        });

        if (userReservations.length === 0) {
            return { success: true, message: "Henüz rezervasyonunuz yok." };
        }

        let message = "📅 Rezervasyonlarınız:\n\n";
        userReservations.forEach(line => {
            const [date, time, table, name, party, special] = line.split(',');
            message += `📅 ${date} ${time}\n`;
            message += `🪑 Masa ${table}\n`;
            message += `👥 ${party} kişi\n`;
            message += `📝 ${special || 'Yok'}\n\n`;
        });

        return { success: true, message: message };
    }

    // Günlük rezervasyonları listele
    getDailyReservations(date) {
        const dateKey = date;
        if (!this.reservations[dateKey]) {
            return { reservations: [], message: "Bu tarihte rezervasyon bulunmuyor." };
        }

        const dailyReservations = [];
        for (const [time, tables] of Object.entries(this.reservations[dateKey])) {
            tables.forEach(tableNumber => {
                dailyReservations.push({
                    time: time,
                    tableNumber: tableNumber,
                    tableInfo: this.tables[tableNumber]
                });
            });
        }

        return { 
            reservations: dailyReservations.sort((a, b) => a.time.localeCompare(b.time)),
            message: `${dailyReservations.length} rezervasyon bulundu.`
        };
    }
}

module.exports = RestaurantManager;