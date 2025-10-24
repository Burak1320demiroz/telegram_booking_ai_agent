# 🤖 Telegram Bot Kurulum Rehberi

## Telegram Bot Token Alma

### 1. BotFather'ı Başlatın
1. Telegram'da [@BotFather](https://t.me/botfather) hesabını arayın
2. `/start` yazın

### 2. Yeni Bot Oluşturun
1. `/newbot` komutunu gönderin
2. Bot'unuz için bir isim seçin (örn: "YZT Döner Rezervasyon")
3. Bot'unuz için bir kullanıcı adı seçin (örn: "yzt_doner_bot" - `_bot` ile bitmeli)
4. BotFather size bir token verecek:
   ```
   8191910524:AAFhhcd4bgp3i5TGo12-LEKNSmiz9-NQh3Y
   ```

### 3. Bot'u Özelleştirin (Opsiyonel)

#### Açıklama Ekle
```
/setdescription
```
Örnek: "YZT Döner restoranı için rezervasyon yapmanızı sağlayan akıllı asistan"

#### Hakkında Bilgisi
```
/setabouttext
```
Örnek: "YZT Döner - AI Destekli Rezervasyon Botu 🌯"

#### Profil Fotoğrafı
```
/setuserpic
```
Restaurant logo'nuzu yükleyin

#### Komutlar Ekle
```
/setcommands
```
Şu komutları ekleyin:
```
start - Botla konuşmaya başla
rezervasyon - Yeni rezervasyon yap
iptal - Rezervasyon iptali
yardim - Yardım menüsü
```

## .env Dosyası Oluşturma

1. Proje dizininde `.env` dosyası oluşturun:
```bash
nano .env
```

2. Aşağıdaki içeriği yapıştırın ve token'ınızı ekleyin:
```env
TELEGRAM_BOT_TOKEN=8191910524:AAFhhcd4bgp3i5TGo12-LEKNSmiz9-NQh3Y
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
DATA_DIR=/Users/dai/github/telegram_booking_ai_agent/data
SESSION_SECRET=restoran-secret-2025
PORT=3000
```

3. Kaydedin (Ctrl+O, Enter, Ctrl+X)

## Ollama Kurulumu

### macOS
```bash
# Ollama'yı indirin ve kurun
brew install ollama

# Ollama servisini başlatın
ollama serve

# Yeni bir terminal açın ve model'i indirin
ollama pull gemma3:4b
```

### Linux
```bash
# Ollama'yı kurun
curl -fsSL https://ollama.com/install.sh | sh

# Servisi başlatın
sudo systemctl start ollama

# Model'i indirin
ollama pull gemma3:4b
```

## Uygulamayı Başlatma

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Uygulamayı başlatın:
```bash
npm start
```

Şu çıktıyı görmelisiniz:
```
🤖 Telegram bot başlatıldı...
🌯 YZT Döner Rezervasyon Sistemi çalışıyor - Port: 3000
📊 Dashboard: http://localhost:3000
```

## Bot'u Test Etme

1. Telegram'da bot'unuzu arayın (örn: @yzt_doner_bot)
2. `/start` yazın veya "Merhaba" gönderin
3. Bot size cevap vermeye başlamalı!

## Sorun Giderme

### Bot cevap vermiyor
- ✅ `.env` dosyasındaki token'ı kontrol edin
- ✅ Ollama servisinin çalıştığından emin olun: `ollama list`
- ✅ Model'in indirildiğini kontrol edin: `ollama list`
- ✅ Console loglarını kontrol edin

### "Model not found" hatası
```bash
ollama pull gemma3:4b
```

### Port already in use
`.env` dosyasında farklı bir port deneyin:
```env
PORT=3001
```

### Polling error
- İnternet bağlantınızı kontrol edin
- Proxy kullanıyorsanız ayarlarını kontrol edin
- Token'ın doğru olduğundan emin olun

## Webhook Kullanımı (Production için)

Production ortamında webhook kullanmanız önerilir:

```javascript
// Polling yerine webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    webHook: {
        port: process.env.PORT,
        host: '0.0.0.0'
    }
});

// Webhook URL'ini ayarlayın
bot.setWebHook(`https://yourdomain.com/bot${process.env.TELEGRAM_BOT_TOKEN}`);
```

## Güvenlik İpuçları

1. ❌ Token'ı asla paylaşmayın
2. ❌ Token'ı git'e commitlemeyin
3. ✅ `.env` dosyasını `.gitignore`'a ekleyin
4. ✅ Production'da HTTPS kullanın
5. ✅ Environment variables kullanın

## Bot Komutları

Bot'unuza şu komutları ekleyebilirsiniz:

```javascript
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Merhaba! YZT Döner\'e hoş geldiniz! 🌯 Rezervasyon yapmak için benimle konuşabilirsiniz.');
});

bot.onText(/\/yardim/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `
📋 Komutlar:
/rezervasyon - Yeni rezervasyon yap
/iptal - Rezervasyon iptali
/yardim - Bu mesaj

💬 Doğal dil ile de konuşabilirsiniz!
Örn: "Yarın 4 kişi için saat 19:00'da rezervasyon yapmak istiyorum"
    `);
});
```

## Dashboard Erişimi

Bot çalışırken aynı zamanda web dashboard'a da erişebilirsiniz:
- **Dashboard:** http://localhost:3000/index.html
- **Web Chat:** http://localhost:3000/chat.html

Her iki kanal (Telegram + Web) aynı veritabanını kullanır!

## Production Deployment

### PM2 ile Deploy
```bash
npm install -g pm2
pm2 start src/index.js --name yzt-doner
pm2 save
pm2 startup
```

### Docker ile Deploy
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]
```

```bash
docker build -t yzt-doner-bot .
docker run -d --env-file .env -p 3000:3000 yzt-doner-bot
```

---

## ✅ Başarılı Kurulum Kontrol Listesi

- [ ] BotFather'dan token aldım
- [ ] `.env` dosyasını oluşturdum
- [ ] Ollama kurdun ve çalışıyor
- [ ] `gemma3:4b` modelini indirdim
- [ ] `npm install` çalıştırdım
- [ ] `npm start` ile başlattım
- [ ] Bot Telegram'da çalışıyor
- [ ] Dashboard'a erişebildim
- [ ] Test rezervasyonu yaptım

Tebrikler! Botunuz hazır! 🎉

