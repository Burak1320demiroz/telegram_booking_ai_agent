# 🌯 YZT Döner Rezervasyon Sistemi

YZT Döner restoranı için yapay zeka destekli rezervasyon yönetim sistemi.

## 🚀 Özellikler

- ✅ Doğal dil işleme ile rezervasyon alma
- ✅ Gemma2:2b AI modeli ile akıllı sohbet
- ✅ Gerçek zamanlı rezervasyon takibi
- ✅ Web tabanlı yönetim paneli
- ✅ Otomatik bilgi çıkarma (tarih, saat, kişi sayısı, isim)
- ✅ Masa atama sistemi

## 📋 Gereksinimler

- Node.js (v14+)
- Ollama (gemma2:2b modeli yüklü)

## 🔧 Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Ollama'da Gemma modelini yükleyin:
```bash
ollama pull gemma2:2b
```

3. Uygulamayı başlatın:
```bash
npm start
```

## 🎯 Kullanım

### Müşteri Arayüzü (Rezervasyon Yapma)
- **URL:** http://localhost:3000/chat.html
- Müşteriler bu arayüzden rezervasyon yapabilir
- Bot adım adım bilgi toplar:
  - Tarih
  - Saat  
  - Kişi sayısı
  - Ad soyad
  - Özel istekler (opsiyonel)

### Yönetim Paneli (Dashboard)
- **URL:** http://localhost:3000/index.html
- Tüm rezervasyonları görüntüleme
- Rezervasyonları filtreleme
- Rezervasyon iptali
- Canlı mesaj takibi
- İstatistikler

## 🤖 API Endpoints

- `POST /api/chat` - Chatbot ile konuşma
- `GET /api/stats` - İstatistikleri getir
- `GET /api/messages` - Mesaj geçmişini getir
- `GET /api/reservations` - Tüm rezervasyonları getir
- `POST /api/reservation/cancel` - Rezervasyon iptali

## 🏪 Restoran Bilgileri

- **Çalışma Saatleri:** 11:00 - 23:00
- **Kapasite:** 10 masa (2-6 kişilik)
- **Özellikler:** Meşhur döner, meze çeşitleri, taze içecekler

## 📝 Örnek Konuşma

```
Müşteri: Merhaba
Bot: Merhaba! YZT Döner'e hoş geldiniz! 🌯 Rezervasyon için size yardımcı olabilirim. Hangi tarih için rezervasyon yapmak istersiniz?

Müşteri: Yarın için
Bot: Harika! Saat kaçta gelmek istersiniz?

Müşteri: Akşam 7'de
Bot: Mükemmel! Kaç kişi olacaksınız?

Müşteri: 4 kişi
Bot: Çok güzel! Adınız nedir?

Müşteri: Ahmet Yılmaz
Bot: Teşekkürler Ahmet Yılmaz! Rezervasyonunuzu onaylıyorum...
```

## 💾 Veri Saklama

- Rezervasyonlar ve mesajlar hafıza (memory) içinde saklanır
- Sunucu yeniden başlatıldığında veriler sıfırlanır
- Kalıcı saklama için veritabanı eklenebilir (MongoDB, PostgreSQL vb.)

## 🔄 Güncellemeler

- CSV okuma özelliği kaldırıldı
- Gemma2:2b modeli kullanılıyor
- Web tabanlı rezervasyon sistemi eklendi
- Otomatik bilgi çıkarma sistemi

## 📞 Destek

Sorularınız için: support@yztdoner.com

