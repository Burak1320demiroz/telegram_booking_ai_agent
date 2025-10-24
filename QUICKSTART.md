# ⚡ Hızlı Başlangıç

## 1️⃣ .env Dosyası Oluşturun

Proje dizininde `.env` dosyası oluşturun ve aşağıdaki içeriği ekleyin:

```bash
cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=8191910524:AAFhhcd4bgp3i5TGo12-LEKNSmiz9-NQh3Y
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
DATA_DIR=/Users/dai/github/telegram_booking_ai_agent/data
SESSION_SECRET=restoran-secret-2025
PORT=3000
EOF
```

**Not:** Token'ınızı değiştirmeyi unutmayın!

## 2️⃣ Gemma Modelini İndirin

```bash
ollama pull gemma3:4b
```

**Not:** Eğer `gemma3:4b` bulunamazsa, `gemma2:2b` kullanabilirsiniz:
```bash
ollama pull gemma2:2b
```

Ardından `.env` dosyasında `OLLAMA_MODEL=gemma2:2b` yapın.

## 3️⃣ Bağımlılıkları Yükleyin

```bash
npm install
```

## 4️⃣ Başlatın!

```bash
npm start
```

## ✅ Test Edin

1. **Telegram'da:** Bot'unuza mesaj gönderin
2. **Web'de:** http://localhost:3000/chat.html adresini açın
3. **Dashboard:** http://localhost:3000/index.html

---

## 🔧 Alternatif Model Seçenekleri

Eğer `gemma3:4b` çalışmazsa:

### Gemma2:2b (Daha küçük, hızlı)
```bash
ollama pull gemma2:2b
```
`.env` dosyasında: `OLLAMA_MODEL=gemma2:2b`

### Gemma2:9b (Daha büyük, akıllı)
```bash
ollama pull gemma2:9b
```
`.env` dosyasında: `OLLAMA_MODEL=gemma2:9b`

### Llama3.1:8b (Alternatif)
```bash
ollama pull llama3.1:8b
```
`.env` dosyasında: `OLLAMA_MODEL=llama3.1:8b`

---

## 🚨 Sorun mu var?

### Ollama çalışmıyor
```bash
# macOS
brew services start ollama

# Linux
sudo systemctl start ollama
```

### Model bulunamadı
```bash
# Mevcut modelleri listele
ollama list

# Model varsa ama çalışmıyorsa, tekrar indir
ollama pull gemma2:2b
```

### Port zaten kullanımda
`.env` dosyasında farklı port:
```
PORT=3001
```

---

## 📝 Tek Komutta Çalıştırma

```bash
# Her şeyi sırayla çalıştır
echo "TELEGRAM_BOT_TOKEN=YOUR_TOKEN_HERE
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma2:2b
DATA_DIR=$PWD/data
SESSION_SECRET=restoran-secret-2025
PORT=3000" > .env && \
ollama pull gemma2:2b && \
npm install && \
npm start
```

**Token'ınızı değiştirmeyi unutmayın!**

