# 🌯 YZT Döner - Telegram Rezervasyon Botu

YZT Döner restoranı için yapay zeka destekli Telegram rezervasyon botu ve yönetim sistemi.

## 🚀 Özellikler

- ✅ **Telegram Bot Entegrasyonu** - Telegram üzerinden doğal dil ile rezervasyon
- ✅ **Sohbet Geçmişi** - Kullanıcı başına hafıza (conversation memory)
- ✅ **Gemma3:4b AI Modeli** - Akıllı ve hızlı yanıtlar
- ✅ **Web Dashboard** - Rezervasyonları görüntüleme ve yönetme
- ✅ **Gerçek Zamanlı Takip** - Tüm mesajları ve rezervasyonları anlık izleme
- ✅ **Otomatik Bilgi Çıkarma** - Tarih, saat, kişi sayısı, isim otomatik algılama

## 📋 Gereksinimler

- Node.js (v14+)
- Ollama (gemma3:4b modeli yüklü)
- Telegram Bot Token ([BotFather](https://t.me/botfather)'dan alınabilir)

## 🔧 Kurulum

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Ollama Modelini Yükleyin
```bash
ollama pull gemma3:4b
```

### 3. .env Dosyası Oluşturun
`.env.example` dosyasını kopyalayıp `.env` olarak kaydedin ve bilgilerinizi girin:

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:
```env
TELEGRAM_BOT_TOKEN=...
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
DATA_DIR=/Users/dai/github/telegram_booking_ai_agent/data
SESSION_SECRET=restoran-secret-2025
PORT=3000
```

### 4. Uygulamayı Başlatın
```bash
npm start
```

veya geliştirme modu için:
```bash
npm run dev
```

## 🤖 Telegram Bot Kullanımı

1. Telegram'da botunuzu arayın (BotFather'dan aldığınız username)
2. `/start` komutu ile başlatın veya direkt mesaj yazın
3. Bot sizinle konuşmaya başlayacak ve rezervasyon bilgilerini toplayacak:
   - Tarih
   - Saat
   - Kişi sayısı
   - Ad soyad
   - Özel istekler (opsiyonel)

### Örnek Konuşma

```
Sen: Merhaba
Bot: Merhaba! YZT Döner'e hoş geldiniz! 🌯 Rezervasyon için size yardımcı olabilirim. Hangi tarih için rezervasyon yapmak istersiniz?

Sen: Yarın için
Bot: Harika! Saat kaçta gelmek istersiniz?

Sen: Akşam 7'de
Bot: Mükemmel! Kaç kişi olacaksınız?

Sen: 4 kişi
Bot: Çok güzel! Adınız nedir?

Sen: Ahmet Yılmaz
Bot: Teşekkürler Ahmet Yılmaz! Rezervasyonunuzu kaydettim...
```

## 📱 Web Dashboard

Dashboard'a tarayıcınızdan erişin:

### Yönetim Paneli
- **URL:** http://localhost:3000/index.html
- Tüm rezervasyonları görüntüleme
- Tarihe göre filtreleme
- Rezervasyon iptali
- Canlı mesaj takibi
- İstatistikler

### Müşteri Arayüzü (Web Chat)
- **URL:** http://localhost:3000/chat.html
- Web üzerinden de rezervasyon yapılabilir

## 🔄 Özellikler

### Sohbet Geçmişi
- ✅ Her kullanıcı için ayrı hafıza
- ✅ Son 50 mesaj çifti saklanır
- ✅ Geçmiş konuşmalar hatırlanır
- ✅ Bağlam korunur

### Otomatik Rezervasyon
- Bot konuşma sırasında otomatik olarak bilgileri çıkarır
- Gerekli tüm bilgiler toplandığında rezervasyon oluşturulur
- Dashboard'dan anlık görülebilir

## 🛠 API Endpoints

- `POST /api/chat` - Web chat endpoint
- `GET /api/stats` - İstatistikler
- `GET /api/messages` - Mesaj geçmişi
- `GET /api/reservations` - Tüm rezervasyonlar
- `POST /api/reservation/cancel` - Rezervasyon iptali
- `POST /api/clear` - Chat geçmişini temizle

## 🏪 Restoran Bilgileri

- **Çalışma Saatleri:** 11:00 - 23:00
- **Kapasite:** 10 masa (2-6 kişilik)
- **Özellikler:** Meşhur dönerler, meze çeşitleri, taze içecekler

## 📊 Veri Yönetimi

- Rezervasyonlar ve mesajlar hafızada (in-memory) tutulur
- Sunucu yeniden başlatıldığında veriler sıfırlanır
- Kalıcı saklama için MongoDB veya PostgreSQL eklenebilir

## 🔐 Güvenlik

- `.env` dosyası `.gitignore` içinde
- Session secret kullanılıyor
- Bot token'ı güvenli şekilde saklanıyor

## 📝 Komutlar

```bash
npm start        # Uygulamayı başlat
npm run dev      # Geliştirme modu (nodemon ile)
```

## 🐛 Hata Ayıklama

Console'da şu logları göreceksiniz:
- `📱 Telegram mesaj` - Gelen Telegram mesajları
- `✅ Yeni rezervasyon oluşturuldu` - Başarılı rezervasyonlar
- `❌ Telegram bot error` - Bot hataları

## 🚀 Production'a Alma

1. `.env` dosyasını production sunucuya kopyalayın
2. `NODE_ENV=production` ekleyin
3. Process manager kullanın (PM2 önerilir):
```bash
npm install -g pm2
pm2 start src/index.js --name yzt-doner-bot
```

## 📞 Destek

Telegram: @YZTDoner
Email: support@yztdoner.com

## 📄 Lisans

MIT License

---

**Not:** Bu sistem hem Telegram bot hem de web arayüzü ile çalışır. İkisi de aynı hafıza ve rezervasyon sistemini kullanır.
