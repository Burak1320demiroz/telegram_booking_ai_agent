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

// Helper function to extract date from message
function extractDate(message) {
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/;
    const match = message.match(dateRegex);
    if (match) {
        let dateStr = match[0];
        // Normalize date format to YYYY-MM-DD
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
            return `2024-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return null;
}

// Helper function to extract time from message
function extractTime(message) {
    const timeRegex = /(\d{1,2}):(\d{2})/;
    const match = message.match(timeRegex);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return null;
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
        `Sen YZT Döner restoranının samimi ve kibar rezervasyon asistanısın. Müşterilerle dostça konuş, onları sıcak karşıla.

Kişiliğin:
- Samimi, kibar ve yardımsever
- YZT Döner'ın lezzetli yemeklerini öven
- Müşteri memnuniyetini önceleyen
- Doğal ve sıcak konuşan
- Sabırlı ve anlayışlı

Restoran Bilgileri (YZT Döner):
- 20 masa var (her masa 4 kişilik)
- Çalışma saatleri: 12:00-23:00
- Özel döner çeşitleri ve taze malzemeler
- Sıcak ve samimi atmosfer
- Aile işletmesi, geleneksel lezzetler

Konuşma tarzın:
- "Hoş geldiniz! YZT Döner'a nasıl yardımcı olabilirim?"
- "Tabii ki, hemen yardımcı olayım"
- "Harika bir seçim! Bu lezzetli yemeğimizi çok seveceksiniz"
- "Başka bir şey yardımcı olabileceğim var mı?"
- "Afiyet olsun! YZT Döner'da keyifli vakit geçirmenizi dilerim"

Görevlerin:
- Rezervasyon almak ve yönetmek
- Menü hakkında bilgi vermek
- YZT Döner'ın özel lezzetlerini tanıtmak
- Müşteri sorularını yanıtlamak

Davranış kuralları:
- Her zaman samimi ve kibar ol
- YZT Döner'ın özel lezzetlerini öv
- Müşteri memnuniyetini öncele
- Doğal ve sıcak konuş
- Türkçe konuş

Eğer müşteri daha önce konuştuysan, o konuşmaları hatırla ve devam et.`
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

        // Eğer kullanıcı rezervasyon sürecindeyse, sadece rezervasyon adımlarını işle
        const userReservationState = userReservationStates.get(userId) || {};
        if (userReservationState.step) {
            // Kullanıcı rezervasyon sürecinde, AI yanıt verme
            return;
        }

        if (!isReservationRelated) {
            // İlk mesaj ise hoş geldin mesajı gönder
            if (messageText.toLowerCase().includes('/start') || 
                messageText.toLowerCase().includes('merhaba') || 
                messageText.toLowerCase().includes('selam') ||
                messageText.toLowerCase().includes('hi') ||
                messageText.toLowerCase().includes('hello')) {
                
                const welcomeMessages = [
                    `🍽️ Merhaba! YZT Döner'a hoş geldiniz! 🥙\n\nBen YZT Döner'ın rezervasyon asistanıyım. Size nasıl yardımcı olabilirim?\n\n📋 Yapabileceklerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations\n• Rezervasyon iptal etmek için /cancel`,
                    `🥙 Hoş geldiniz! YZT Döner'da sizi ağırlamak için buradayım! 🍽️\n\nBen rezervasyon asistanınızım. Size nasıl yardımcı olabilirim?\n\n📋 Hizmetlerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations\n• Rezervasyon iptal etmek için /cancel`,
                    `🍽️ Merhaba! YZT Döner'ın lezzetli yemeklerini tatmak için buradayım! 🥙\n\nBen rezervasyon asistanınızım. Size nasıl yardımcı olabilirim?\n\n📋 Yapabileceklerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations\n• Rezervasyon iptal etmek için /cancel`,
                    `🥙 Hoş geldiniz! YZT Döner'da keyifli vakit geçirmeniz için buradayım! 🍽️\n\nBen rezervasyon asistanınızım. Size nasıl yardımcı olabilirim?\n\n📋 Hizmetlerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations\n• Rezervasyon iptal etmek için /cancel`,
                    `🍽️ Merhaba! YZT Döner'da sıcak karşılama sizi bekliyor! 🥙\n\nBen rezervasyon asistanınızım. Size nasıl yardımcı olabilirim?\n\n📋 Yapabileceklerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations\n• Rezervasyon iptal etmek için /cancel`
                ];
                
                const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            } else {
                // Diğer mesajlar için AI ile çeşitli cevaplar
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
                    // Fallback mesajı
                    const fallbackMessages = [
                        `🍽️ YZT Döner'da size nasıl yardımcı olabilirim?\n\n📋 Hizmetlerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations`,
                        `🥙 YZT Döner'ın lezzetli yemeklerini tatmak için buradayım!\n\n📋 Yapabileceklerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations`,
                        `🍽️ YZT Döner'da keyifli vakit geçirmeniz için buradayım!\n\n📋 Hizmetlerim:\n• Rezervasyon yapmak için "rezervasyon" yazın\n• Menü görmek için "menü" yazın\n• Rezervasyonlarınızı görmek için /myreservations`
                    ];
                    
                    const randomMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
                    await bot.sendMessage(chatId, randomMessage);
                }
                return;
            }
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

        // Rezervasyon isteği kontrolü - Adım adım bilgi toplama
        if (isReservationRequest(messageText)) {
            // Kullanıcının mevcut rezervasyon durumunu kontrol et
            const userReservationState = userReservationStates.get(userId) || {};
            
            // Eğer kullanıcı zaten rezervasyon sürecindeyse ve "rezervasyon" yazarsa, mevcut durumu sıfırla
            if (userReservationState.step && messageText.toLowerCase().trim() === 'rezervasyon') {
                userReservationStates.delete(userId);
                await bot.sendMessage(chatId, '🔄 Rezervasyon süreci sıfırlandı. Yeni rezervasyon yapmak için bilgilerinizi alalım!');
            }
            
            if (!userReservationState.step) {
                // İlk adım: İsim ve soyisim
                userReservationState.step = 'name';
                userReservationStates.set(userId, userReservationState);
                
                // Farklı karşılama mesajları
                const welcomeMessages = [
                    `🍽️ Merhaba! YZT Döner'da rezervasyon yapmak için çok mutluyum!\n\n👤 Lütfen adınızı ve soyadınızı yazın:\n(Örnek: Ahmet Yılmaz)`,
                    `🥙 Hoş geldiniz! YZT Döner'da sizi ağırlamak için sabırsızlanıyorum!\n\n👤 Adınızı ve soyadınızı öğrenebilir miyim?\n(Örnek: Ahmet Yılmaz)`,
                    `🍽️ YZT Döner'da rezervasyon yapmak harika bir seçim!\n\n👤 Lütfen adınızı ve soyadınızı belirtin:\n(Örnek: Ahmet Yılmaz)`,
                    `🥙 Merhaba! YZT Döner'ın lezzetli yemeklerini tatmak için rezervasyon yapıyoruz!\n\n👤 Adınızı ve soyadınızı yazabilir misiniz?\n(Örnek: Ahmet Yılmaz)`,
                    `🍽️ YZT Döner'da rezervasyon yapmak için buradayım!\n\n👤 Lütfen adınızı ve soyadınızı paylaşın:\n(Örnek: Ahmet Yılmaz)`
                ];
                
                const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            }
            
            if (userReservationState.step === 'name') {
                // İsim soyisim alındı, masa seçimi
                userReservationState.name = messageText.trim();
                userReservationState.step = 'table';
                userReservationStates.set(userId, userReservationState);
                
                // Farklı isim onay mesajları
                const nameConfirmMessages = [
                    `✅ Harika ${userReservationState.name}! Sizi YZT Döner'da ağırlamak için sabırsızlanıyorum!\n\n🪑 Hangi masa numarasını tercih edersiniz? (1-20 arası)\n(Örnek: 5)`,
                    `🥙 Mükemmel ${userReservationState.name}! YZT Döner'da sizi bekliyoruz!\n\n🪑 Hangi masa numarasını seçmek istersiniz? (1-20 arası)\n(Örnek: 5)`,
                    `🍽️ Çok güzel ${userReservationState.name}! YZT Döner'ın lezzetli yemeklerini tadacaksınız!\n\n🪑 Tercih ettiğiniz masa numarası nedir? (1-20 arası)\n(Örnek: 5)`,
                    `✅ Harika ${userReservationState.name}! YZT Döner'da keyifli vakit geçireceksiniz!\n\n🪑 Hangi masa numarasını tercih edersiniz? (1-20 arası)\n(Örnek: 5)`,
                    `🥙 Süper ${userReservationState.name}! YZT Döner'da sizi ağırlamak için hazırız!\n\n🪑 Masa numaranızı seçin: (1-20 arası)\n(Örnek: 5)`
                ];
                
                const randomMessage = nameConfirmMessages[Math.floor(Math.random() * nameConfirmMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            }
            
            if (userReservationState.step === 'table') {
                const tableNumber = parseInt(messageText.trim());
                if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > 20) {
                    await bot.sendMessage(chatId, `❌ Lütfen 1-20 arası geçerli bir masa numarası girin.`);
                    return;
                }
                
                userReservationState.table = tableNumber;
                userReservationState.step = 'time';
                userReservationStates.set(userId, userReservationState);
                
                // Farklı masa onay mesajları
                const tableConfirmMessages = [
                    `✅ Mükemmel! Masa ${tableNumber} çok güzel bir seçim!\n\n🕐 Hangi saatte rezervasyon yapmak istiyorsunuz? (12:00-23:00 arası)\n(Örnek: 19:30)`,
                    `🥙 Harika! Masa ${tableNumber} sizin için mükemmel!\n\n🕐 Tercih ettiğiniz saat nedir? (12:00-23:00 arası)\n(Örnek: 19:30)`,
                    `🍽️ Süper! Masa ${tableNumber} çok güzel bir tercih!\n\n🕐 Hangi saatte rezervasyon yapmak istersiniz? (12:00-23:00 arası)\n(Örnek: 19:30)`,
                    `✅ Çok güzel! Masa ${tableNumber} sizi bekliyor!\n\n🕐 Rezervasyon saatinizi belirtin: (12:00-23:00 arası)\n(Örnek: 19:30)`,
                    `🥙 Mükemmel seçim! Masa ${tableNumber} çok şık!\n\n🕐 Hangi saatte gelmek istiyorsunuz? (12:00-23:00 arası)\n(Örnek: 19:30)`
                ];
                
                const randomMessage = tableConfirmMessages[Math.floor(Math.random() * tableConfirmMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            }
            
            if (userReservationState.step === 'time') {
                const time = messageText.trim();
                const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
                if (!timeRegex.test(time)) {
                    await bot.sendMessage(chatId, `❌ Lütfen geçerli bir saat formatı girin (HH:MM)\n(Örnek: 19:30)`);
                    return;
                }
                
                userReservationState.time = time;
                userReservationState.step = 'date';
                userReservationStates.set(userId, userReservationState);
                
                // Farklı saat onay mesajları
                const timeConfirmMessages = [
                    `✅ Harika! ${time} saatinde YZT Döner'ın lezzetli yemeklerini tadacaksınız!\n\n📅 Hangi tarihte rezervasyon yapmak istiyorsunuz?\n(Format: YYYY-MM-DD, Örnek: 2025-10-25)`,
                    `🥙 Mükemmel! ${time} saatinde YZT Döner'da harika vakit geçireceksiniz!\n\n📅 Rezervasyon tarihinizi belirtin:\n(Format: YYYY-MM-DD, Örnek: 2025-10-25)`,
                    `🍽️ Süper! ${time} saatinde YZT Döner'ın özel lezzetlerini tadacaksınız!\n\n📅 Hangi tarihte rezervasyon yapmak istersiniz?\n(Format: YYYY-MM-DD, Örnek: 2025-10-25)`,
                    `✅ Çok güzel! ${time} saatinde YZT Döner'da sizi bekliyoruz!\n\n📅 Tarih seçiminiz nedir?\n(Format: YYYY-MM-DD, Örnek: 2025-10-25)`,
                    `🥙 Harika seçim! ${time} saatinde YZT Döner'ın lezzetli yemeklerini tadacaksınız!\n\n📅 Hangi tarihte rezervasyon yapmak istiyorsunuz?\n(Format: YYYY-MM-DD, Örnek: 2025-10-25)`
                ];
                
                const randomMessage = timeConfirmMessages[Math.floor(Math.random() * timeConfirmMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            }
            
            if (userReservationState.step === 'date') {
                const date = messageText.trim();
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(date)) {
                    await bot.sendMessage(chatId, `❌ Lütfen geçerli bir tarih formatı girin (YYYY-MM-DD)\n(Örnek: 2025-10-25)`);
                    return;
                }
                
                // Tarih aralığı kontrolü
                const reservationDate = new Date(date);
                const today = new Date();
                const maxDate = new Date('2025-12-31');
                
                if (reservationDate < today || reservationDate > maxDate) {
                    await bot.sendMessage(chatId, `❌ Rezervasyonlar sadece bugünden itibaren 31 Aralık 2025'e kadar yapılabilir.`);
                    return;
                }
                
                userReservationState.date = date;
                userReservationState.step = 'confirm';
                userReservationStates.set(userId, userReservationState);
                
                // Masa müsaitlik kontrolü
                const availableTables = restaurantManager.getAvailableTables(date, userReservationState.time);
                const isTableAvailable = availableTables.success && availableTables.tables.includes(userReservationState.table);
                
                if (!isTableAvailable) {
                    await bot.sendMessage(chatId, `❌ ${date} ${userReservationState.time} tarihinde Masa ${userReservationState.table} müsait değil.\n\nLütfen farklı bir masa, saat veya tarih seçin.`);
                    userReservationState.step = 'table'; // Masa seçimine geri dön
                    userReservationStates.set(userId, userReservationState);
                    return;
                }
                
                // Farklı özet mesajları
                const summaryMessages = [
                    `📋 Rezervasyon Özeti:\n\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${date}\n\n🍽️ YZT Döner'da harika bir deneyim yaşayacaksınız!\n\n✅ Bu rezervasyonu onaylamak için "EVET" yazın\n❌ İptal etmek için "HAYIR" yazın`,
                    `📋 Rezervasyon Detayları:\n\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${date}\n\n🥙 YZT Döner'da lezzetli yemekler sizi bekliyor!\n\n✅ Onaylamak için "EVET" yazın\n❌ İptal etmek için "HAYIR" yazın`,
                    `📋 Rezervasyon Bilgileri:\n\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${date}\n\n🍽️ YZT Döner'da keyifli vakit geçireceksiniz!\n\n✅ Onaylamak için "EVET" yazın\n❌ İptal etmek için "HAYIR" yazın`,
                    `📋 Rezervasyon Özeti:\n\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${date}\n\n🥙 YZT Döner'ın özel lezzetlerini tadacaksınız!\n\n✅ Bu rezervasyonu onaylamak için "EVET" yazın\n❌ İptal etmek için "HAYIR" yazın`,
                    `📋 Rezervasyon Detayları:\n\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${date}\n\n🍽️ YZT Döner'da sıcak karşılama sizi bekliyor!\n\n✅ Onaylamak için "EVET" yazın\n❌ İptal etmek için "HAYIR" yazın`
                ];
                
                const randomMessage = summaryMessages[Math.floor(Math.random() * summaryMessages.length)];
                await bot.sendMessage(chatId, randomMessage);
                return;
            }
            
            if (userReservationState.step === 'confirm') {
                const response = messageText.trim().toLowerCase();
                
                if (response === 'evet' || response === 'yes' || response === 'onayla') {
                    // Rezervasyonu yap
                    const result = restaurantManager.makeReservation(
                        userReservationState.date,
                        userReservationState.time,
                        userReservationState.table,
                        userReservationState.name,
                        4, // Varsayılan kişi sayısı
                        "Telegram rezervasyon",
                        userId // User ID'yi arka planda ekle
                    );
                    
                    if (result.success) {
                        // Farklı başarı mesajları
                        const successMessages = [
                            `🎉 Harika! Rezervasyonunuz başarıyla oluşturuldu!\n\n📋 Rezervasyon Detayları:\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${userReservationState.date}\n\n🍽️ YZT Döner'da sizi bekliyoruz! Afiyet olsun!\n\nRezervasyon iptal etmek için: /cancel ${userReservationState.date} ${userReservationState.time} ${userReservationState.table}\nRezervasyonlarınızı görmek için: /myreservations`,
                            `🥙 Mükemmel! Rezervasyonunuz onaylandı!\n\n📋 Rezervasyon Bilgileri:\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${userReservationState.date}\n\n🍽️ YZT Döner'da lezzetli yemekler sizi bekliyor!\n\nRezervasyon iptal etmek için: /cancel ${userReservationState.date} ${userReservationState.time} ${userReservationState.table}\nRezervasyonlarınızı görmek için: /myreservations`,
                            `✅ Süper! Rezervasyonunuz hazır!\n\n📋 Rezervasyon Detayları:\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${userReservationState.date}\n\n🥙 YZT Döner'da keyifli vakit geçireceksiniz!\n\nRezervasyon iptal etmek için: /cancel ${userReservationState.date} ${userReservationState.time} ${userReservationState.table}\nRezervasyonlarınızı görmek için: /myreservations`,
                            `🎉 Çok güzel! Rezervasyonunuz tamamlandı!\n\n📋 Rezervasyon Bilgileri:\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${userReservationState.date}\n\n🍽️ YZT Döner'da sıcak karşılama sizi bekliyor!\n\nRezervasyon iptal etmek için: /cancel ${userReservationState.date} ${userReservationState.time} ${userReservationState.table}\nRezervasyonlarınızı görmek için: /myreservations`,
                            `🥙 Harika! Rezervasyonunuz başarıyla kaydedildi!\n\n📋 Rezervasyon Detayları:\n👤 İsim: ${userReservationState.name}\n🪑 Masa: ${userReservationState.table}\n🕐 Saat: ${userReservationState.time}\n📅 Tarih: ${userReservationState.date}\n\n🍽️ YZT Döner'ın özel lezzetlerini tadacaksınız!\n\nRezervasyon iptal etmek için: /cancel ${userReservationState.date} ${userReservationState.time} ${userReservationState.table}\nRezervasyonlarınızı görmek için: /myreservations`
                        ];
                        
                        const randomMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
                        await bot.sendMessage(chatId, randomMessage);
                    } else {
                        await bot.sendMessage(chatId, `❌ Rezervasyon yapılamadı: ${result.message}`);
                    }
                    
                    // Rezervasyon durumunu temizle
                    userReservationStates.delete(userId);
                } else if (response === 'hayır' || response === 'no' || response === 'iptal') {
                    await bot.sendMessage(chatId, `❌ Rezervasyon iptal edildi. YZT Döner'da başka bir rezervasyon yapmak isterseniz "rezervasyon" yazabilirsiniz.`);
                    userReservationStates.delete(userId);
                } else {
                    await bot.sendMessage(chatId, `❓ Lütfen "EVET" veya "HAYIR" yazın.`);
                }
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
console.log('Model: gemma3:1b');
console.log('Waiting for messages...');