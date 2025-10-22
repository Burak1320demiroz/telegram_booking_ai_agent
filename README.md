# YZT Döner - Telegram Rezervasyon Botu

🍽️ **YZT Döner** restoranı için geliştirilmiş akıllı Telegram rezervasyon botu. Ollama ve LangChain kullanarak doğal dil işleme, adım adım rezervasyon sistemi ve admin paneli sunar.

## 🚀 Özellikler

### 🤖 Akıllı Rezervasyon Sistemi
- **Adım adım rezervasyon**: İsim → Masa → Saat → Tarih → Onay
- **Kullanıcı bazlı hafıza**: Her kullanıcı için ayrı konuşma geçmişi
- **Rezervasyon yönetimi**: İptal etme, görüntüleme, değiştirme
- **Masa müsaitlik kontrolü**: Gerçek zamanlı masa durumu

### 🍽️ Menü Sistemi
- **Günlük menü**: Tarih bazlı menü görüntüleme
- **Stok yönetimi**: Otomatik stok takibi
- **Haftalık döngü**: 7 günlük menü rotasyonu

### 🎯 AI Asistan
- **Doğal konuşma**: Ollama gemma3:12b modeli
- **Çeşitli cevaplar**: Her seferinde farklı yanıtlar
- **YZT Döner odaklı**: Restoran markası vurgusu
- **Samimi ton**: Sıcak ve kibar konuşma

### 📊 Admin Paneli
- **Gerçek zamanlı izleme**: Mesaj logları, rezervasyonlar
- **Saatlik takvim**: 12:00-23:00 masa görünümü
- **Stok yönetimi**: Ürün stokları ve güncelleme
- **CSV düzenleyici**: Veri dosyalarını doğrudan düzenleme

## 🛠️ Kurulum

### Gereksinimler
- Node.js 18+
- Ollama (gemma3:12b modeli)
- Telegram Bot Token

### 1. Projeyi Klonlayın
```bash
git clone https://github.com/your-username/telegram_booking_ai_agent.git
cd telegram_booking_ai_agent
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Ollama Kurulumu
```bash
# Ollama'yı indirin ve kurun
curl -fsSL https://ollama.ai/install.sh | sh

# Ollama servisini başlatın
ollama serve

# Gemma3:12b modelini indirin
ollama pull gemma3:12b
```

### 4. Çevre Değişkenlerini Ayarlayın

#### 4.1 Telegram Bot Token Alın
1. Telegram'da [@BotFather](https://t.me/BotFather) ile konuşun
2. `/newbot` komutunu gönderin
3. Bot adını girin (örn: YZT Döner Bot)
4. Bot kullanıcı adını girin (örn: yzt_doner_bot)
5. Size verilen token'ı kopyalayın

#### 4.2 .env Dosyası Oluşturun
Proje ana dizininde `.env` dosyası oluşturun:

**Windows (Notepad ile):**
```bash
# Proje klasöründe sağ tık → Yeni → Metin Belgesi
# Dosya adını ".env" olarak kaydedin (tırnak işaretleri ile)
```

**Mac/Linux (Terminal ile):**
```bash
touch .env
```

#### 4.3 .env Dosyası İçeriği
`.env` dosyasına şu içeriği ekleyin:

```env
# Telegram Bot Token (BotFather'dan aldığınız token)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Ollama Ayarları
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:1b

# Veri Dizini
DATA_DIR=./data

# Port (Opsiyonel)
PORT=3000
```

**⚠️ Önemli:** 
- `TELEGRAM_BOT_TOKEN` kısmına BotFather'dan aldığınız gerçek token'ı yazın
- `.env` dosyasını asla GitHub'a yüklemeyin (güvenlik riski)
- Token'ınızı kimseyle paylaşmayın

#### 4.4 .env.example Dosyası (Opsiyonel)
Diğer geliştiriciler için `.env.example` dosyası oluşturun:

```env
# Telegram Bot Token (BotFather'dan alın)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Ollama Ayarları
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:1b

# Veri Dizini
DATA_DIR=./data

# Port (Opsiyonel)
PORT=3000
```

Bu dosya GitHub'a yüklenebilir ve diğer geliştiriciler için rehber olarak kullanılabilir.

### 5. Veri Klasörünü Hazırlayın
```bash
mkdir data
# CSV dosyaları otomatik oluşturulacak
```

### 6. GitHub için Hazırlık

#### 6.1 .gitignore Dosyası Oluşturun
Proje ana dizininde `.gitignore` dosyası oluşturun:

```gitignore
# Çevre değişkenleri (güvenlik için)
.env

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Veri dosyaları (opsiyonel)
data/
*.csv

# Log dosyaları
*.log

# İşletim sistemi
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

#### 6.2 GitHub'a Yükleme
```bash
# Git repository başlatın
git init

# Dosyaları ekleyin
git add .

# İlk commit
git commit -m "Initial commit: YZT Döner Telegram Bot"

# GitHub repository oluşturun ve bağlayın
git remote add origin https://github.com/your-username/telegram_booking_ai_agent.git
git branch -M main
git push -u origin main
```

### 7. Botu Başlatın
```bash
# Geliştirme modu
npm run dev

# Üretim modu
npm start
```

## 📱 Kullanım

### Telegram Bot Komutları
- `/start` - Botu başlat
- `/myreservations` - Rezervasyonlarınızı görüntüle
- `/cancel YYYY-MM-DD HH:MM TABLE` - Rezervasyon iptal et
- `/reset` - Rezervasyon durumunu sıfırla

### Rezervasyon Yapma
1. Bot'a "rezervasyon" yazın
2. Adınızı ve soyadınızı girin
3. Masa numarasını seçin (1-20)
4. Saati belirtin (12:00-23:00)
5. Tarihi girin (YYYY-MM-DD)
6. "EVET" yazarak onaylayın

### Menü Görüntüleme
- "menü" yazarak günlük menüyü görün
- "bugün menüde ne var?" gibi sorular sorun

## 🎛️ Admin Paneli

Admin paneli `http://localhost:3000` adresinde çalışır:

### Özellikler
- **İstatistikler**: Toplam rezervasyon, mesaj, kullanıcı sayıları
- **Mesaj Logları**: Gelen/giden tüm mesajlar
- **Rezervasyon Yönetimi**: Tüm rezervasyonları görüntüleme ve iptal etme
- **Saatlik Takvim**: 20 masa × 12 saat görünümü
- **Stok Yönetimi**: Ürün stoklarını güncelleme
- **CSV Düzenleyici**: Veri dosyalarını doğrudan düzenleme

## 📁 Proje Yapısı

```
telegram_booking_ai_agent/
├── src/
│   ├── index.js          # Ana bot dosyası
│   └── yazman.js         # Restoran yönetim sistemi
├── data/                 # CSV veri dosyaları
│   ├── tables.csv        # Masa bilgileri
│   ├── reservations.csv # Rezervasyonlar
│   ├── stocks.csv       # Stok bilgileri
│   └── ...
├── public/
│   └── index.html        # Admin paneli
├── package.json
└── README.md
```

## 🔧 API Endpoints

### Admin Panel API'leri
- `GET /api/stats` - Bot istatistikleri
- `GET /api/messages` - Mesaj logları
- `GET /api/reservations` - Tüm rezervasyonlar
- `GET /api/stocks` - Stok bilgileri
- `POST /api/stock/update` - Stok güncelleme
- `POST /api/reservation/cancel` - Rezervasyon iptal
- `GET /api/menu/:date` - Günlük menü
- `GET /api/csv` - CSV dosya okuma
- `POST /api/csv` - CSV dosya yazma

## 🤝 Katkıda Bulunanlar

Bu proje **Bursa Yapay Zeka Topluluğu** için geliştirilmiştir.

### 👥 Katkıda Bulunanlar
- **Ozan Aydın** - Proje geliştirici
- **Burak Demiröz** - Proje geliştirici  
- **Barış Eren** - Proje geliştirici

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🆘 Sorun Giderme

### Bot Yanıt Vermiyor
1. Ollama servisinin çalıştığını kontrol edin: `ollama serve`
2. Gemma3:12b modelinin yüklü olduğunu kontrol edin: `ollama list`
3. Telegram bot token'ının doğru olduğunu kontrol edin

### Rezervasyon Yapılamıyor
1. Veri klasörünün mevcut olduğunu kontrol edin
2. CSV dosyalarının doğru formatta olduğunu kontrol edin
3. Tarih formatının YYYY-MM-DD olduğunu kontrol edin

### Admin Panel Açılmıyor
1. Port 3000'in kullanımda olmadığını kontrol edin
2. Bot'un çalıştığını kontrol edin
3. Tarayıcı konsolunda hata mesajlarını kontrol edin

## 📞 İletişim

- **GitHub**: [Proje Sayfası](https://github.com/your-username/telegram_booking_ai_agent)
- **Bursa Yapay Zeka Topluluğu**: [Topluluk Sayfası](https://github.com/bursa-yapay-zeka)

---

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**
