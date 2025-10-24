# 🤖 Telegram Bot Versiyonu - Değişiklik Özeti

## ✨ Yeni Özellikler

### 1. **Telegram Bot Entegrasyonu** 🎯
- Telegram üzerinden mesajları dinliyor
- Her kullanıcı için ayrı sohbet geçmişi
- Gerçek zamanlı cevaplar
- Typing indicator desteği

### 2. **Çift Kanal Desteği** 📱💻
- **Telegram:** Bot üzerinden rezervasyon
- **Web:** Chat arayüzü üzerinden rezervasyon
- Her iki kanal aynı veritabanını kullanır
- Tüm mesajlar merkezi Dashboard'da görünür

### 3. **Sohbet Geçmişi** 🧠
- Her Telegram kullanıcısı için ayrı hafıza
- Her web session için ayrı hafıza
- Son 50 mesaj çifti saklanır
- Konuşma bağlamı korunur

### 4. **Gemma3:4b Model Desteği** 🤖
- `.env` dosyasından model seçimi
- Çevresel değişkenler ile yapılandırma
- Kolay model değişimi

## 📁 Yeni Dosyalar

```
✅ .env                    # Çevresel değişkenler (yeni oluşturuldu)
✅ .env.example            # Örnek konfigürasyon
✅ README.md               # Ana dökümantasyon (güncellenmiş)
✅ TELEGRAM_SETUP.md       # Bot kurulum rehberi
✅ QUICKSTART.md           # Hızlı başlangıç
✅ TELEGRAM_VERSION.md     # Bu dosya
```

## 🔧 Değiştirilen Dosyalar

### `src/index.js`
- ✅ Telegram Bot entegrasyonu eklendi
- ✅ `getUserMemory()` fonksiyonu (Telegram için)
- ✅ `getSessionMemory()` fonksiyonu (Web için)
- ✅ `createChatPrompt()` fonksiyonu (tek yer)
- ✅ Bot message handler
- ✅ Çevresel değişken desteği

### `package.json`
- ✅ `node-telegram-bot-api` bağımlılığı eklendi
- ✅ Proje adı güncellendi

### `public/index.html` ve `chat.html`
- Değişiklik yok (mevcut web arayüzleri çalışmaya devam ediyor)

## 🎯 Nasıl Çalışır?

### Telegram Akışı
```
1. Kullanıcı Telegram'da mesaj gönderir
2. Bot mesajı alır (bot.on('message'))
3. Kullanıcının hafızası yüklenir (getUserMemory)
4. LangChain ile AI cevabı üretilir
5. Cevap kullanıcıya gönderilir
6. Rezervasyon bilgileri çıkarılır (extractReservationInfo)
7. Yeterli bilgi varsa rezervasyon oluşturulur
8. Dashboard'da görünür
```

### Web Akışı
```
1. Kullanıcı web'de mesaj gönderir
2. POST /api/chat endpoint'i çağrılır
3. Session hafızası yüklenir (getSessionMemory)
4. LangChain ile AI cevabı üretilir
5. Cevap JSON olarak döner
6. Rezervasyon bilgileri çıkarılır
7. Dashboard'da görünür
```

## 🗂 Hafıza Yönetimi

### Telegram Kullanıcıları
```javascript
const userMemories = new Map();
// Key: Telegram User ID
// Value: BufferMemory (50 mesaj)
```

### Web Kullanıcıları
```javascript
const sessionMemories = new Map();
// Key: Express Session ID
// Value: BufferMemory (50 mesaj)
```

Her kanal kendi hafızasını tutar, karışmaz!

## 📊 Veri Yapısı

### Rezervasyonlar
```javascript
{
  date: "2025-10-24",
  time: "19:00",
  table_number: 5,
  customer_name: "Ahmet Yılmaz",
  party_size: 4,
  special_requests: "",
  user_id: "123456789",  // Telegram veya session ID
  timestamp: Date
}
```

### Mesajlar
```javascript
{
  userId: "123456789",
  userName: "Ahmet Yılmaz",
  message: "Yarın 4 kişi için",
  type: "incoming", // veya "outgoing"
  timestamp: Date
}
```

## 🚀 Çalıştırma

### Geliştirme
```bash
npm start
```

### Production
```bash
pm2 start src/index.js --name yzt-doner
```

### Docker
```bash
docker build -t yzt-doner .
docker run -d --env-file .env -p 3000:3000 yzt-doner
```

## 🔐 Güvenlik

- ✅ `.env` dosyası `.gitignore`'da
- ✅ Bot token güvenli
- ✅ Session secret kullanılıyor
- ✅ CORS yapılandırılmış

## 📈 İstatistikler

Dashboard'da gösterilen:
- Toplam rezervasyon sayısı
- Toplam mesaj sayısı
- Aktif kullanıcı sayısı (Telegram + Web)
- Bugünkü rezervasyon sayısı

## 🎨 Kullanıcı Deneyimi

### Telegram
- ✅ Typing indicator
- ✅ Anında cevaplar
- ✅ Doğal dil anlama
- ✅ Emoji desteği

### Web
- ✅ Modern chat arayüzü
- ✅ Gerçek zamanlı
- ✅ Responsive tasarım
- ✅ Animasyonlu mesajlar

## 🔄 Senkronizasyon

Her iki kanal (Telegram + Web) aynı:
- ✅ Rezervasyon listesi
- ✅ Mesaj geçmişi
- ✅ İstatistikler

Ancak **FARKLI**:
- ❌ Sohbet hafızası (her kullanıcı/session için ayrı)

## 📱 Test Senaryosu

1. **Telegram'da rezervasyon yap**
2. **Dashboard'da görün** ✅
3. **Web'den rezervasyon yap**
4. **Dashboard'da ikisini de gör** ✅
5. **Telegram'da geçmiş konuşmanı hatırla** ✅
6. **Web'de kendi geçmişini hatırla** ✅

## 🎉 Özet

- 🤖 Telegram bot çalışıyor
- 💻 Web arayüzü çalışıyor
- 🧠 Sohbet geçmişi çalışıyor
- 📊 Dashboard çalışıyor
- 🌯 YZT Döner hazır!

---

**Versiyon:** 2.0.0 (Telegram Edition)
**Model:** gemma3:4b
**Node Version:** 14+
**Durum:** ✅ Hazır ve Çalışıyor

