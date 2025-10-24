# 📋 Yapılan Değişiklikler / Changes Made

## ✨ Ana Değişiklikler / Main Changes

### 1. **Model Değişikliği / Model Change**
- ❌ Eski: `llama3.1:latest`
- ✅ Yeni: `gemma2:2b`

### 2. **CSV Okuma Özelliği Kaldırıldı / CSV Reading Removed**
- Prescription handler ve CSV işleme tamamen kaldırıldı
- Artık sadece web üzerinden rezervasyon alınıyor

### 3. **Yeni Asistan Tipi / New Assistant Type**
- ❌ Eski: Lokman Hekim (Doktor Asistanı)
- ✅ Yeni: YZT Döner Rezervasyon Asistanı

### 4. **Web Arayüzü Geliştirmeleri / Web Interface Improvements**
- **Chat Interface:** `/chat.html` - Müşteriler için rezervasyon arayüzü
- **Dashboard:** `/index.html` - Yönetim paneli (rezervasyonları görüntüleme, iptal etme)
- Dashboard'a "Rezervasyon Yap" butonu eklendi

### 5. **Veri Saklama / Data Storage**
- Rezervasyonlar artık bellek (in-memory) içinde saklanıyor
- Mesaj geçmişi kaydediliyor
- CSV dosyaları kullanılmıyor

## 📁 Dosya Değişiklikleri / File Changes

### ✏️ Değiştirilen / Modified
- `src/index.js` - Tamamen yeniden yazıldı
- `public/index.html` - Dashboard'a rezervasyon butonu eklendi
- `package.json` - Proje adı ve bağımlılıklar güncellendi

### ➕ Eklenen / Added
- `public/chat.html` - Yeni müşteri rezervasyon arayüzü
- `README_YZT.md` - Sistem kullanım kılavuzu
- `CHANGES.md` - Bu dosya

### ➖ Kaldırılan / Removed
- `src/prescriptionHandler.js` - Artık kullanılmıyor
- `src/yazman.js` - Silinmiş
- CSV işleme kodları
- node-fetch bağımlılığı
- csv-parse bağımlılığı
- node-telegram-bot-api bağımlılığı

## 🎯 Yeni API Endpoints

1. **POST /api/chat**
   - Chatbot ile konuşma
   - Body: `{ message, userId, userName }`

2. **GET /api/stats**
   - İstatistikleri getir
   - Response: `{ totalReservations, totalMessages, activeUsers }`

3. **GET /api/messages**
   - Mesaj geçmişi

4. **GET /api/reservations**
   - Tüm rezervasyonlar

5. **POST /api/reservation/cancel**
   - Rezervasyon iptali
   - Body: `{ date, time, tableNumber }`

## 🔄 Rezervasyon Akışı / Booking Flow

1. Müşteri `/chat.html` üzerinden bot ile konuşur
2. Bot sırayla sorar:
   - Tarih
   - Saat
   - Kişi sayısı
   - Ad soyad
   - Özel istekler (opsiyonel)
3. Bilgiler toplandığında otomatik rezervasyon oluşturulur
4. Yöneticiler `/index.html` üzerinden tüm rezervasyonları görebilir

## 🚀 Çalıştırma / Running

```bash
# Bağımlılıkları yükle
npm install

# Modeli yükle
ollama pull gemma2:2b

# Başlat
npm start
```

## 📱 Erişim / Access

- **Müşteri Arayüzü:** http://localhost:3000/chat.html
- **Yönetim Paneli:** http://localhost:3000/index.html

## ⚡ Özellikler / Features

- ✅ Türkçe doğal dil desteği
- ✅ Otomatik bilgi çıkarma (regex based)
- ✅ Gerçek zamanlı güncelleme (5 saniyede bir)
- ✅ Responsive tasarım
- ✅ Modern ve kullanıcı dostu arayüz
- ✅ Session-based memory management

