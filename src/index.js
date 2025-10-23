require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { ChatOllama } = require('@langchain/community/chat_models/ollama');
const { BufferMemory } = require('langchain/memory');
const { ConversationChain } = require('langchain/chains');
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require("langchain/prompts");
const RestaurantManager = require('./yazman');

// Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Telegram Bot Token - Bu değeri .env dosyasına eklemeniz gerekiyor
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
}

// Telegram Bot'u başlat
const bot = new TelegramBot(token, { 
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Bot hata yönetimi
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
    // Polling hatalarını logla ama botu durdurma
});

bot.on('error', (error) => {
    console.log('Bot error:', error.message);
    // Bot hatalarını logla ama botu durdurma
});

// Initialize LangChain with env-configurable model
const model = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:12b",
    temperature: 0.7,
});

// Initialize Restaurant Manager
const restaurantManager = new RestaurantManager();

// User-specific memory storage (Telegram user ID bazlı)
const userMemories = new Map();

// User-specific reservation states
const userReservationStates = new Map();

// Message logs for admin panel
const messageLogs = [];

// Helper function to get or create memory for a user
function getUserMemory(userId) {
    if (!userMemories.has(userId)) {
        const memory = new BufferMemory({
            k: 50, // Son 50 mesaj çiftini tutar
            returnMessages: true,
            memoryKey: "history",
            inputKey: "input",
            humanPrefix: "Human",
            aiPrefix: "Assistant"
        });
        userMemories.set(userId, memory);
    }
    return userMemories.get(userId);
}

// Helper function to parse date from natural language
function parseDateNatural(input) {
    const text = input.toLowerCase().trim();
    const today = new Date();
    
    // Bugün, yarın patterns
    if (text === 'bugün') {
        return today.toISOString().split('T')[0];
    }
    if (text === 'yarın') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
    
    // Türkçe aylar
    const months = {
        'ocak': 1, 'şubat': 2, 'mart': 3, 'nisan': 4, 'mayıs': 5, 'haziran': 6,
        'temmuz': 7, 'ağustos': 8, 'eylül': 9, 'ekim': 10, 'kasım': 11, 'aralık': 12
    };
    
    // "21 aralık", "7 haziran 2025" gibi
    for (const [monthName, monthNum] of Object.entries(months)) {
        if (text.includes(monthName)) {
            const parts = text.split(/\s+/);
            const day = parseInt(parts[0]);
            let year = 2025;
            
            // Yıl varsa al
            for (const part of parts) {
                if (/20\d{2}/.test(part)) {
                    year = parseInt(part);
                }
            }
            
            if (!isNaN(day) && day >= 1 && day <= 31) {
                return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }
    
    // Standart formatlar: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/;
    const match = text.match(dateRegex);
    if (match) {
        let dateStr = match[0];
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    
    return null;
}

// Helper function to extract date from message (legacy)
function extractDate(message) {
    return parseDateNatural(message);
}

// Helper function to parse time from natural language
function parseTimeNatural(input) {
    const text = input.toLowerCase().trim();
    
    // Saat isimleri
    const timeNames = {
        'öğlen': '12:00',
        'akşam': '19:00',
        'akşam yemeği': '19:00',
        'öğle yemeği': '12:00'
    };
    
    for (const [name, time] of Object.entries(timeNames)) {
        if (text.includes(name)) {
            return time;
        }
    }
    
    // "akşam 8", "akşam sekiz"
    if (text.includes('akşam')) {
        const hourMatch = text.match(/(\d{1,2})/);
        if (hourMatch) {
            const hour = parseInt(hourMatch[1]);
            if (hour >= 1 && hour <= 12) {
                return `${hour + 12}:00`;
            }
        }
    }
    
    // Yazılı sayılar
    const numberWords = {
        'bir': 1, 'iki': 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6,
        'yedi': 7, 'sekiz': 8, 'dokuz': 9, 'on': 10, 'onbir': 11, 'oniki': 12,
        'onüç': 13, 'ondört': 14, 'onbeş': 15, 'onaltı': 16, 'onyedi': 17,
        'onsekiz': 18, 'ondokuz': 19, 'yirmi': 20, 'yirmibirler': 21, 'yirmiiki': 22, 'yirmiüç': 23
    };
    
    for (const [word, hour] of Object.entries(numberWords)) {
        if (text.includes(word)) {
            return `${String(hour).padStart(2, '0')}:00`;
        }
    }
    
    // Standart formatlar: HH:MM, HH.MM, HH,MM
    const timeRegex = /(\d{1,2})[:\.،,](\d{2})/;
    const match = text.match(timeRegex);
    if (match) {
        const hour = parseInt(match[1]);
        const minute = parseInt(match[2]);
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }
    }
    
    // Sadece saat: "20", "8"
    const hourOnlyMatch = text.match(/^(\d{1,2})$/);
    if (hourOnlyMatch) {
        const hour = parseInt(hourOnlyMatch[1]);
        if (hour >= 12 && hour <= 23) {
            return `${String(hour).padStart(2, '0')}:00`;
        } else if (hour >= 1 && hour <= 11) {
            return `${String(hour + 12).padStart(2, '0')}:00`;
        }
    }
    
    return null;
}

// Helper function to extract time from message (legacy)
function extractTime(message) {
    return parseTimeNatural(message);
}

// Helper function to extract party size from message
function extractPartySize(message) {
    const sizeRegex = /(\d+)\s*(kişi|person|kişilik)/i;
    const match = message.match(sizeRegex);
    if (match) {
        return parseInt(match[1]);
    }
    return null;
}

// Helper function to check if message contains reservation request
function isReservationRequest(message) {
    const keywords = [
        'rezervasyon', 'masa', 'tarih', 'saat', 'kişi', 'reservation', 'table', 'book',
        'rezzervasyon', 'rezervasyonu', 'rezervasyonu', 'rezervasyonu',
        'rezervasyon yapmak', 'rezervasyon yapmak istiyorum', 'rezervasyon yapmak istiyotum',
        'rezervasyon yap', 'rezervasyon yapmak', 'rezervasyon yapmak istiyorum',
        'masa rezervasyonu', 'masa rezervasyonu yapmak', 'masa rezervasyonu yapmak istiyorum',
        'rezervasyon yapmak istiyorum', 'rezervasyon yapmak istiyotum', 'rezervasyon yapmak istiyorum'
    ];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
}

// Helper function to check if message asks for menu
function isMenuRequest(message) {
    const keywords = ['menü', 'menu', 'yemek', 'ne var', 'neler var'];
    return keywords.some(keyword => message.toLowerCase().includes(keyword));
}

// Restaurant reservation agent prompt
const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
        `Sen YZT Döner rezervasyon asistanısın. Samimi ve profesyonel konuş.yzt döner restorantı hakkında ve rezervasyon işlemleri dışında bişi sorarsa cevap vermeyeceğini bilmediğini söyle.

🎯 REZERVASYON BAŞLARKEN:
İlk mesajda TEK SEFERDE SOR:
"Merhaba! YZT Döner'e hoş geldin 🍽️

Rezervasyon için şu bilgileri ver:
• Adın soyadın
• Kaç kişi (1-4)
• Hangi gün (bugün/yarın/tarih)
• Saat (12:00-23:00)

Örnek: Ahmet Yılmaz, 3 kişi, yarın, 20:00"

💬 CEVAPLARI İŞLE:
- Eksik bilgi varsa → sadece eksik olanı sor
- Tüm bilgi varsa → müsait masaları göster
- Masa seçince → özet göster, onayla

🗣️ ÖRNEKLER:
- "Ahmet, 3 kişi, yarın, 20:00" → ✅ "Müsait masalar: 1,5,10. Hangisi?"
- "Ahmet, 3 kişi" → ❌ "Hangi gün ve saat?"
- "yarın 20:00" → ❌ "Adın ve kaç kişi?"

⚠️ KURALLAR:
- İLK MESAJ: hepsini birden iste
- Kısa konuş
- Parantez YOK
- Döner/sipariş sorma

✅ TEK SEFERDE BİLGİ AL!`
    ),
    new MessagesPlaceholder("history"),
    HumanMessagePromptTemplate.fromTemplate("{input}")
]);

// Bot mesajlarını dinle
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;

    console.log(`User ${userId} (${msg.from.first_name}): ${messageText}`);

    // Log incoming message
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'incoming',
        userId: userId,
        userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
        chatId: chatId,
        message: messageText
    };
    messageLogs.push(logEntry);
    if (messageLogs.length > 100) messageLogs.shift(); // Keep last 100

    try {
        // Sadece rezervasyon ile ilgili mesajları işle
        const isReservationRelated = isReservationRequest(messageText) || 
                                   isMenuRequest(messageText) || 
                                   messageText.startsWith('/cancel') || 
                                   messageText.startsWith('/myreservations');

        // Kullanıcının rezervasyon durumunu al
        const userReservationState = userReservationStates.get(userId) || {};
        
        // Rezervasyon sürecindeyse, LLM ile doğal işle
        if (userReservationState.step) {
            // Rezervasyon durumu bilgisini oluştur
            let contextInfo = `\n\n[REZERVASYON DURUMU]\nAşama: ${userReservationState.step}`;
            
            if (userReservationState.step === 'all_info') {
                contextInfo += '\nŞimdi: Tüm bilgileri (isim, kişi sayısı, tarih, saat) parse et';
            } else if (userReservationState.step === 'name') {
                contextInfo += '\nŞimdi: İsim-soyisim bekle';
            } else if (userReservationState.step === 'partySize') {
                contextInfo += `\nİsim: ${userReservationState.name}`;
                contextInfo += '\nŞimdi: Kaç kişilik masa istediğini sor (1-4 kişi)';
            } else if (userReservationState.step === 'date') {
                contextInfo += `\nİsim: ${userReservationState.name}, Kişi: ${userReservationState.partySize}`;
                contextInfo += '\nŞimdi: Hangi tarihte istediğini sor. "bugün, yarın, 21 aralık" gibi doğal ifadeleri kabul et';
            } else if (userReservationState.step === 'time') {
                contextInfo += `\nİsim: ${userReservationState.name}, Kişi: ${userReservationState.partySize}, Tarih: ${userReservationState.date}`;
                contextInfo += '\nŞimdi: Hangi saatte istediğini sor. "20:30, 20.30, akşam 8" gibi doğal ifadeleri kabul et';
            } else if (userReservationState.step === 'table') {
                contextInfo += `\nİsim: ${userReservationState.name}, Kişi: ${userReservationState.partySize}, Tarih: ${userReservationState.date}, Saat: ${userReservationState.time}`;
                if (userReservationState.availableTables) {
                    const tableNums = userReservationState.availableTables.map(t => t.number).join(', ');
                    contextInfo += `\nMüsait masalar: ${tableNums}`;
                    contextInfo += '\nŞimdi: Bir masa numarası seçmesini bekle veya "hepsi olur" derse ilk masayı ata';
                }
            } else if (userReservationState.step === 'confirm') {
                contextInfo += `\nİsim: ${userReservationState.name}, Kişi: ${userReservationState.partySize}, Tarih: ${userReservationState.date}, Saat: ${userReservationState.time}, Masa: ${userReservationState.table}`;
                contextInfo += '\nŞimdi: Onay bekle (evet/hayır)';
            }
            
            contextInfo += `\n\n[USER MESSAGE]: ${messageText}`;
            
            // LLM ile işle
            const memory = getUserMemory(userId);
            const chain = new ConversationChain({
                llm: model,
                memory: memory,
                prompt: chatPrompt
            });
            
            const response = await chain.call({
                input: messageText + contextInfo
            });
            
            // Yanıttan bilgileri çıkar ve rezervasyon durumunu güncelle
            const responseText = response.response;
            
            // Tek seferde tüm bilgileri parse et
            if (userReservationState.step === 'all_info') {
                // İsim parse et (ilk 1-2 kelime)
                const words = messageText.trim().split(/[\s,]+/);
                let name = '';
                let partySize = null;
                let dateStr = '';
                let timeStr = '';
                
                // İsim bul (sayı olmayanlar)
                for (let i = 0; i < words.length && i < 3; i++) {
                    if (isNaN(parseInt(words[i])) && !words[i].includes(':') && !words[i].includes('.')) {
                        name += (name ? ' ' : '') + words[i];
                    } else {
                        break;
                    }
                }
                
                // Kişi sayısı bul
                for (const word of words) {
                    const num = parseInt(word);
                    if (!isNaN(num) && num >= 1 && num <= 10) {
                        partySize = num;
                        break;
                    }
                }
                
                // Tarih ve saat parse et
                const text = messageText.toLowerCase();
                if (text.includes('bugün')) dateStr = 'bugün';
                else if (text.includes('yarın')) dateStr = 'yarın';
                else {
                    // Tarih formatı ara (gün ay)
                    const dateMatch = text.match(/(\d{1,2})\s*(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/);
                    if (dateMatch) dateStr = dateMatch[0];
                }
                
                // Saat parse et
                const timeMatch = text.match(/(\d{1,2})[:.\/]?(\d{2})?/);
                if (timeMatch) timeStr = timeMatch[0];
                
                // Eksik bilgi kontrolü
                const missing = [];
                if (!name) missing.push('Adın soyadın');
                if (!partySize) missing.push('Kaç kişi');
                if (!dateStr) missing.push('Hangi gün');
                if (!timeStr) missing.push('Saat');
                
                if (missing.length > 0) {
                    await bot.sendMessage(chatId, `Eksik bilgiler: ${missing.join(', ')}\n\nTekrar yaz: Örnek "Ahmet Yılmaz, 3 kişi, yarın, 20:00"`);
                    return;
                }
                
                // Bilgileri kaydet ve işle
                userReservationState.name = name;
                userReservationState.partySize = partySize > 4 ? 4 : partySize;
                
                const parsedDate = parseDateNatural(dateStr);
                const parsedTime = parseTimeNatural(timeStr);
                
                if (parsedDate && parsedTime) {
                    userReservationState.date = parsedDate;
                    userReservationState.time = parsedTime;
                    
                    // Müsait masaları kontrol et
                    const availableTables = restaurantManager.getAvailableTables(parsedDate, parsedTime, userReservationState.partySize);
                    
                    if (availableTables.available && availableTables.tables.length > 0) {
                        let tableList = availableTables.tables.map(t => t.number).join(', ');
                        await bot.sendMessage(chatId, `✅ ${name}, ${partySize} kişi, ${parsedDate} ${parsedTime}\n\n📋 Müsait masalar: ${tableList}\n\nHangi masayı istersin?`);
                        userReservationState.availableTables = availableTables.tables;
                        userReservationState.step = 'table';
                        userReservationStates.set(userId, userReservationState);
                        return;
                    } else {
                        await bot.sendMessage(chatId, `❌ ${parsedDate} ${parsedTime}'de müsait masa yok. Başka tarih/saat dene.`);
                        userReservationStates.delete(userId);
                        return;
                    }
                } else {
                    await bot.sendMessage(chatId, `Tarih/saat anlaşılamadı. Tekrar yaz: "Ahmet, 3 kişi, yarın, 20:00"`);
                    return;
                }
            }
            // İsim aşaması
            else if (userReservationState.step === 'name') {
                userReservationState.name = messageText.trim();
                userReservationState.step = 'partySize';
                userReservationStates.set(userId, userReservationState);
            }
            // Kişi sayısı aşaması
            else if (userReservationState.step === 'partySize') {
                const partySize = parseInt(messageText.trim());
                if (!isNaN(partySize) && partySize > 0 && partySize <= 4) {
                    userReservationState.partySize = partySize;
                    userReservationState.step = 'date';
                    userReservationStates.set(userId, userReservationState);
                } else if (!isNaN(partySize) && partySize > 4) {
                    // 4'ten fazla kişi
                    await bot.sendMessage(chatId, `Masalarımız 4 kişilik. ${Math.ceil(partySize / 4)} masa rezervasyonu yapabiliriz. Şimdilik 4 kişi için devam edelim mi?`);
                    return;
                }
            }
            // Tarih aşaması - Doğal dil desteği
            else if (userReservationState.step === 'date') {
                const parsedDate = parseDateNatural(messageText.trim());
                if (parsedDate) {
                    userReservationState.date = parsedDate;
                    userReservationState.step = 'time';
                    userReservationStates.set(userId, userReservationState);
                }
            }
            // Saat aşaması - Doğal dil desteği
            else if (userReservationState.step === 'time') {
                const parsedTime = parseTimeNatural(messageText.trim());
                if (parsedTime) {
                    userReservationState.time = parsedTime;
                    
                    // Müsait masaları kontrol et
                    const availableTables = restaurantManager.getAvailableTables(userReservationState.date, userReservationState.time, userReservationState.partySize);
                    
                    if (availableTables.available && availableTables.tables.length > 0) {
                        // Müsait masaları göster
                        let tableList = availableTables.tables.map(t => t.number).join(', ');
                        await bot.sendMessage(chatId, responseText + `\n\n📋 Müsait masalar: ${tableList}\n\nBir masa numarası seçin veya "hepsi olur" deyin.`);
                        userReservationState.availableTables = availableTables.tables;
                        userReservationState.step = 'table';
                        userReservationStates.set(userId, userReservationState);
                        return;
                    } else {
                        await bot.sendMessage(chatId, responseText + '\n\n❌ Bu tarih ve saatte müsait masa yok. Başka bir tarih veya saat deneyin.');
                        userReservationState.step = 'date';
                        userReservationStates.set(userId, userReservationState);
                        return;
                    }
                }
            }
            // Masa seçimi aşaması
            else if (userReservationState.step === 'table') {
                const tableNum = parseInt(messageText.trim());
                
                // Masa numarası geçerli mi ve müsait mi kontrol et
                if (!isNaN(tableNum)) {
                    if (tableNum < 1 || tableNum > 20) {
                        await bot.sendMessage(chatId, `20'ye kadar masa var (1-20). Hangi masayı istersin?`);
                        return;
                    }
                    
                    if (userReservationState.availableTables && 
                        userReservationState.availableTables.some(t => t.number === tableNum)) {
                        userReservationState.table = tableNum;
                        userReservationState.step = 'confirm';
                        userReservationStates.set(userId, userReservationState);
                        
                        // Özet göster
                        await bot.sendMessage(chatId, `📋 Özet:\n👤 ${userReservationState.name}\n👥 ${userReservationState.partySize} kişi\n📅 ${userReservationState.date}\n🕐 ${userReservationState.time}\n🪑 Masa ${userReservationState.table}\n\nOnaylıyor musun? (evet/hayır)`);
                        return;
                    } else {
                        // Masa müsait değil
                        const availableList = userReservationState.availableTables.map(t => t.number).join(', ');
                        await bot.sendMessage(chatId, `Masa ${tableNum} müsait değil. Müsait masalar: ${availableList}\n\nHangisini istersin?`);
                        return;
                    }
                } else if (messageText.toLowerCase().includes('hepsi') || messageText.toLowerCase().includes('farketmez') || messageText.toLowerCase().includes('farkmez')) {
                    // İlk müsait masayı seç
                    userReservationState.table = userReservationState.availableTables[0].number;
                    userReservationState.step = 'confirm';
                    userReservationStates.set(userId, userReservationState);
                    
                    await bot.sendMessage(chatId, `📋 Özet:\n👤 ${userReservationState.name}\n👥 ${userReservationState.partySize} kişi\n📅 ${userReservationState.date}\n🕐 ${userReservationState.time}\n🪑 Masa ${userReservationState.table}\n\nOnaylıyor musun? (evet/hayır)`);
                    return;
                }
            }
            // Onay aşaması
            else if (userReservationState.step === 'confirm') {
                if (messageText.toLowerCase().includes('evet') || messageText.toLowerCase().includes('onayla')) {
                    // Rezervasyonu yap
                    const result = restaurantManager.makeReservation(
                        userReservationState.date,
                        userReservationState.time,
                        userReservationState.table,
                        userReservationState.name,
                        userReservationState.partySize,
                        "Telegram rezervasyon",
                        userId
                    );
                    
                    if (result.success) {
                        await bot.sendMessage(chatId, `${responseText}\n\n✅ Rezervasyonunuz kaydedildi!\n\n/myreservations ile görebilir, /cancel ile iptal edebilirsiniz.`);
                    } else {
                        await bot.sendMessage(chatId, `${responseText}\n\n❌ Hata: ${result.message}`);
                    }
                    userReservationStates.delete(userId);
                    return;
                } else if (messageText.toLowerCase().includes('hayır') || messageText.toLowerCase().includes('iptal')) {
                    await bot.sendMessage(chatId, `${responseText}\n\n❌ Rezervasyon iptal edildi.`);
                    userReservationStates.delete(userId);
                    return;
                }
            }
            
            await bot.sendMessage(chatId, responseText);
            
            // Log outgoing message
            messageLogs.push({
                timestamp: new Date().toISOString(),
                type: 'outgoing',
                userId: userId,
                userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
                chatId: chatId,
                message: responseText
            });
            if (messageLogs.length > 100) messageLogs.shift();
            return;
        }

        if (!isReservationRelated) {
            // Konu dışı mesajlar için LLM kullan - samimi ve esprili olsun
                try {
                    const memory = getUserMemory(userId);
                    const chain = new ConversationChain({
                        llm: model,
                        memory: memory,
                        prompt: chatPrompt
                    });

                    const response = await chain.call({
                        input: messageText
                    });

                    await bot.sendMessage(chatId, response.response);
                    
                    // Log outgoing message
                    messageLogs.push({
                        timestamp: new Date().toISOString(),
                        type: 'outgoing',
                        userId: userId,
                        userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
                        chatId: chatId,
                        message: response.response
                    });
                    if (messageLogs.length > 100) messageLogs.shift();
                    
            } catch (error) {
                    console.error('AI response error:', error);
                await bot.sendMessage(chatId, 'Merhaba! Rezervasyon yapmak ister misin?');
            }
            return;
        }

        // Komutlar: /cancel YYYY-MM-DD HH:MM TABLE, /myreservations
        if (messageText && messageText.startsWith('/cancel')) {
            const parts = messageText.split(/\s+/);
            if (parts.length >= 4) {
                const date = parts[1];
                const time = parts[2];
                const tableNumber = parseInt(parts[3]);
                const result = restaurantManager.cancelReservation(date, time, tableNumber, userId);
                await bot.sendMessage(chatId, result.message);
                return;
            } else {
                await bot.sendMessage(chatId, 'Kullanım: /cancel YYYY-MM-DD HH:MM TABLE');
                return;
            }
        }

        if (messageText && messageText.startsWith('/myreservations')) {
            const result = restaurantManager.getUserReservations(userId);
            await bot.sendMessage(chatId, result.message);
            return;
        }

        if (messageText && messageText.startsWith('/reset')) {
            userReservationStates.delete(userId);
            await bot.sendMessage(chatId, '✅ Rezervasyon durumu sıfırlandı. Yeni rezervasyon yapmak için "rezervasyon" yazabilirsiniz.');
            return;
        }
        // Menü isteği kontrolü
        if (isMenuRequest(messageText)) {
            const date = extractDate(messageText) || new Date().toISOString().split('T')[0];
            const menuInfo = restaurantManager.getDailyMenu(date);
            
            if (menuInfo.available) {
                await bot.sendMessage(chatId, `🍽️ YZT Döner'ın ${date} tarihli lezzetli menüsü:\n\n${menuInfo.menu}\n\nAfiyet olsun! 🥙`);
                return;
            } else {
                await bot.sendMessage(chatId, `😔 ${menuInfo.message}\n\nYZT Döner'da başka bir tarih için rezervasyon yapmak ister misiniz?`);
                return;
            }
        }

        // Rezervasyon isteği kontrolü - LLM ile doğal başlat
        if (isReservationRequest(messageText)) {
            // Kullanıcının mevcut rezervasyon durumunu kontrol et
            const userReservationState = userReservationStates.get(userId) || {};
            
            // Eğer kullanıcı zaten rezervasyon sürecindeyse ve "rezervasyon" yazarsa, mevcut durumu sıfırla
            if (userReservationState.step && messageText.toLowerCase().trim() === 'rezervasyon') {
                userReservationStates.delete(userId);
                await bot.sendMessage(chatId, '🔄 Tamam, yeni rezervasyon yapalım!');
            }
            
            if (!userReservationState.step) {
                // İlk adım: Tek seferde tüm bilgileri iste
                userReservationState.step = 'all_info';
                userReservationStates.set(userId, userReservationState);
                
                // LLM ile hoş geldin ve tek seferde bilgi iste
                const welcomeMessage = `Merhaba! YZT Döner'e hoş geldin 🍽️

Rezervasyon için şu bilgileri ver:
• Adın soyadın
• Kaç kişi (1-4)
• Hangi gün (bugün/yarın/tarih)
• Saat (12:00-23:00)

Örnek: Ahmet Yılmaz, 3 kişi, yarın, 20:00`;
                
                await bot.sendMessage(chatId, welcomeMessage);
                
                // Log outgoing message
                messageLogs.push({
                    timestamp: new Date().toISOString(),
                    type: 'outgoing',
                    userId: userId,
                    userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
                    chatId: chatId,
                    message: welcomeMessage
                });
                if (messageLogs.length > 100) messageLogs.shift();
                
                return;
            }
        }

        // Sadece rezervasyon ile ilgili mesajlar için AI kullan (menü hariç)
        // Ama rezervasyon sürecindeyse AI kullanma
        if (isReservationRelated && !isMenuRequest(messageText) && !userReservationState.step) {
            // Kullanıcıya özel memory al
            const memory = getUserMemory(userId);
            
            // Conversation chain oluştur
const chain = new ConversationChain({
    llm: model,
    memory: memory,
    prompt: chatPrompt
});

            // AI'dan cevap al
        const response = await chain.call({
                input: messageText
            });

            // Cevabı Telegram'a gönder
            await bot.sendMessage(chatId, response.response);

            // Log outgoing message
            messageLogs.push({
                timestamp: new Date().toISOString(),
                type: 'outgoing',
                userId: userId,
                userName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
                chatId: chatId,
                message: response.response
            });
            if (messageLogs.length > 100) messageLogs.shift();
        }

    } catch (error) {
        console.error('Error processing message:', error);
        try {
            await bot.sendMessage(chatId, 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.');
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down bot gracefully...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down bot gracefully...');
    bot.stopPolling();
    process.exit(0);
});

// API Endpoints for Admin Panel
app.get('/api/stats', (req, res) => {
    const fs = require('fs');
    const reservationsPath = path.join(restaurantManager.dataDir, 'reservations.csv');
    let reservationCount = 0;
    if (fs.existsSync(reservationsPath)) {
        const content = fs.readFileSync(reservationsPath, 'utf8');
        reservationCount = content.split('\n').filter(l => l.trim() && !l.startsWith('date')).length;
    }

    res.json({
        totalReservations: reservationCount,
        totalMessages: messageLogs.length,
        activeUsers: new Set(messageLogs.map(l => l.userId)).size,
        botStatus: 'online'
    });
});

app.get('/api/messages', (req, res) => {
    res.json(messageLogs.slice().reverse());
});

app.get('/api/reservations', (req, res) => {
    const fs = require('fs');
    const { parse } = require('csv-parse/sync');
    const reservationsPath = path.join(restaurantManager.dataDir, 'reservations.csv');
    
    if (!fs.existsSync(reservationsPath)) {
        return res.json([]);
    }
    
    const content = fs.readFileSync(reservationsPath, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    res.json(records);
});

app.get('/api/stocks', (req, res) => {
    const stocks = Object.entries(restaurantManager.stocks || {}).map(([item, qty]) => ({
        item: item.charAt(0).toUpperCase() + item.slice(1),
        quantity: qty
    }));
    res.json(stocks);
});

app.post('/api/stock/update', (req, res) => {
    const { item, quantity } = req.body;
    const result = restaurantManager.setStock(item, quantity);
    res.json(result);
});

app.post('/api/stock/decrement', (req, res) => {
    const { item, quantity } = req.body;
    const result = restaurantManager.decrementStock(item, quantity || 1);
    res.json(result);
});

app.post('/api/reservation/cancel', (req, res) => {
    const { date, time, tableNumber } = req.body;
    const result = restaurantManager.cancelReservation(date, time, parseInt(tableNumber));
    res.json(result);
});

app.get('/api/menu/:date', (req, res) => {
    const { date } = req.params;
    const result = restaurantManager.getDailyMenu(date);
    res.json(result);
});

// Weekly menu window (7 days) starting from :startDate (YYYY-MM-DD)
app.get('/api/weekly-menu/:startDate', async (req, res) => {
    try {
        const { startDate } = req.params;
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return res.status(400).json({ error: 'Geçersiz tarih' });
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            const menu = restaurantManager.getDailyMenu(iso);
            days.push({ date: iso, menu });
        }
        res.json(days);
    } catch (e) {
        res.status(500).json({ error: 'Weekly menu error' });
    }
});

// CSV management endpoints (admin)
app.get('/api/csv', (req, res) => {
    try {
        const fs = require('fs');
        const file = (req.query.file || '').toString();
        const allowed = new Set(['tables', 'stocks', 'weekly_menus', 'weekly_occupancy', 'reservations']);
        if (!allowed.has(file)) return res.status(400).send('Geçersiz dosya');
        const filePath = path.join(restaurantManager.dataDir, `${file}.csv`);
        if (!fs.existsSync(filePath)) return res.status(404).send('Dosya bulunamadı');
        const content = fs.readFileSync(filePath, 'utf8');
        res.type('text/plain').send(content);
    } catch (e) {
        res.status(500).send('CSV okuma hatası');
    }
});

app.post('/api/csv', (req, res) => {
    try {
        const fs = require('fs');
        const file = (req.query.file || '').toString();
        const allowed = new Set(['tables', 'stocks', 'weekly_menus', 'weekly_occupancy', 'reservations']);
        if (!allowed.has(file)) return res.status(400).send('Geçersiz dosya');
        const { content } = req.body || {};
        if (typeof content !== 'string') return res.status(400).send('Geçersiz içerik');
        const filePath = path.join(restaurantManager.dataDir, `${file}.csv`);
        fs.writeFileSync(filePath, content, 'utf8');
        // Reload affected caches
        if (file === 'stocks') {
            restaurantManager.stocks = restaurantManager.loadStocksCsv();
        } else if (file === 'weekly_menus') {
            restaurantManager.weeklyMenus = restaurantManager.loadWeeklyMenusCsv();
        } else if (file === 'weekly_occupancy') {
            restaurantManager.weeklyOccupancy = restaurantManager.loadWeeklyOccupancyCsv();
        } else if (file === 'reservations') {
            restaurantManager.reservations = {};
            restaurantManager.loadReservationsFromCsv();
        } else if (file === 'tables') {
            restaurantManager.tables = restaurantManager.loadTablesFromCsv();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).send('CSV yazma hatası');
    }
});

// Start Express server
app.listen(port, () => {
    console.log(`Admin Panel: http://localhost:${port}`);
}); 

console.log('Restaurant Reservation Bot is running...');
console.log('Model: gemma3:4b');
console.log('Waiting for messages...');