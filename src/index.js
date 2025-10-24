require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { ChatOllama } = require('@langchain/community/chat_models/ollama');
const { BufferMemory } = require('langchain/memory');
const { ConversationChain } = require('langchain/chains');
const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } = require("langchain/prompts");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize LangChain with Gemma
const model = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
    temperature: 0.7,
});

// In-memory storage
const reservations = [];
const messages = [];
const sessionMemories = new Map();
const userMemories = new Map(); // Telegram user memories

// Helper function to get or create memory for a session (Web)
function getSessionMemory(sessionId) {
    if (!sessionMemories.has(sessionId)) {
        const memory = new BufferMemory({
            k: 50,
            returnMessages: true,
            memoryKey: "history",
            inputKey: "input",
            humanPrefix: "Müşteri",
            aiPrefix: "Asistan"
        });
        sessionMemories.set(sessionId, memory);
    }
    return sessionMemories.get(sessionId);
}

// Helper function to get or create memory for a Telegram user
function getUserMemory(userId) {
    if (!userMemories.has(userId)) {
        const memory = new BufferMemory({
            k: 50,
            returnMessages: true,
            memoryKey: "history",
            inputKey: "input",
            humanPrefix: "Müşteri",
            aiPrefix: "YZT Asistan"
        });
        userMemories.set(userId, memory);
    }
    return userMemories.get(userId);
}

// Function to extract reservation details from conversation
function extractReservationInfo(conversationHistory, userMessage, aiResponse) {
    const allText = conversationHistory + ' ' + userMessage + ' ' + aiResponse;
    
    // Extract date (YYYY-MM-DD format)
    const dateMatch = allText.match(/(\d{4}-\d{2}-\d{2})/);
    
    // Extract time (HH:MM format)
    const timeMatch = allText.match(/(\d{1,2}:\d{2})|saat\s+(\d{1,2})|(\d{1,2})\s+buçuk/i);
    
    // Extract party size
    const partySizeMatch = allText.match(/(\d+)\s*(kişi|kişilik)/i);
    
    // Extract name
    const nameMatch = allText.match(/adım\s+(\w+\s+\w+)|ismim\s+(\w+\s+\w+)|adım\s+(\w+)|ismim\s+(\w+)/i);
    
    // Extract table number if specified
    const tableMatch = allText.match(/masa\s+(\d+)|(\d+)\s+nolu\s+masa/i);
    
    return {
        date: dateMatch ? dateMatch[1] : null,
        time: timeMatch ? (timeMatch[1] || timeMatch[2] || timeMatch[3]) : null,
        partySize: partySizeMatch ? parseInt(partySizeMatch[1]) : null,
        name: nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4]) : null,
        tableNumber: tableMatch ? parseInt(tableMatch[1]) : null
    };
}

// Create conversation prompt
function createChatPrompt() {
    return ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
            `Sen YZT Döner restoranının rezervasyon asistanısın. Müşterilere sıcak, dostça ve profesyonel bir şekilde yardımcı oluyorsun.

Görevin: Müşterilerden rezervasyon için şu bilgileri toplamak:
1. Tarih (gün/ay/yıl veya bugün/yarın gibi)
2. Saat (örn: 19:00, 20:30)
3. Kaç kişi olacakları
4. Müşteri adı ve soyadı
5. Özel istekleri varsa (opsiyonel)

Davranış Kuralları:
- Her seferinde SADECE 1 soru sor
- Kısa ve net cevaplar ver (maksimum 2-3 cümle)
- Türkçe konuş
- Dostane ve samimi ol
- Müşteri bilgi verdiğinde "Harika!" veya "Mükemmel!" gibi olumlu tepkiler ver
- Tüm bilgiler toplandığında özet yap ve onayla

Restoran Bilgileri:
- Çalışma saatleri: 11:00 - 23:00
- Kapasite: 10 masa, her masa 2-6 kişilik
- Özellikler: Meşhur dönerlerimiz, meze çeşitlerimiz ve taze içeceklerimiz var

Önemli: Sohbet geçmişini her zaman hatırla ve müşterinin verdiği bilgileri unutma.
`
        ),
        new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}")
    ]);
}

// Telegram Bot Handlers
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : '');
    const userMessage = msg.text;

    // Skip if not a text message
    if (!userMessage) return;

    console.log(`📱 Telegram mesaj - User: ${userName} (${userId}): ${userMessage}`);

    try {
        // Send typing action
        await bot.sendChatAction(chatId, 'typing');

        // Get user's memory
        const memory = getUserMemory(userId);

        // Store incoming message
        messages.push({
            userId: userId.toString(),
            userName: userName,
            message: userMessage,
            type: 'incoming',
            timestamp: new Date()
        });

        // Create conversation chain
        const chain = new ConversationChain({
            llm: model,
            memory: memory,
            prompt: createChatPrompt()
        });

        // Get AI response
        const response = await chain.call({
            input: userMessage
        });

        const aiMessage = response.response;

        // Store outgoing message
        messages.push({
            userId: userId.toString(),
            userName: 'YZT Asistan',
            message: aiMessage,
            type: 'outgoing',
            timestamp: new Date()
        });

        // Send response to user
        await bot.sendMessage(chatId, aiMessage);

        // Try to extract reservation info
        const conversationHistory = await memory.loadMemoryVariables({});
        const historyText = JSON.stringify(conversationHistory);
        const reservationInfo = extractReservationInfo(historyText, userMessage, aiMessage);

        // Check if we have enough info to create a reservation
        if (reservationInfo.date && reservationInfo.time && reservationInfo.partySize && reservationInfo.name) {
            // Check if reservation already exists
            const exists = reservations.some(r =>
                r.date === reservationInfo.date &&
                r.time === reservationInfo.time &&
                r.customer_name === reservationInfo.name
            );

            if (!exists) {
                const newReservation = {
                    date: reservationInfo.date,
                    time: reservationInfo.time,
                    table_number: reservationInfo.tableNumber || Math.floor(Math.random() * 10) + 1,
                    customer_name: reservationInfo.name,
                    party_size: reservationInfo.partySize,
                    special_requests: '',
                    user_id: userId.toString(),
                    timestamp: new Date()
                };
                reservations.push(newReservation);
                console.log('✅ Yeni rezervasyon oluşturuldu:', newReservation);
            }
        }

    } catch (error) {
        console.error('❌ Telegram bot error:', error);
        await bot.sendMessage(chatId, 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.');
    }
});

// Bot error handler
bot.on('polling_error', (error) => {
    console.error('❌ Telegram polling error:', error);
});

// Bot started message
console.log('🤖 Telegram bot başlatıldı...');

// Chat endpoint (for web interface)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId, userName } = req.body;
        const sessionId = req.session.id;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Store incoming message
        messages.push({
            userId: userId || sessionId,
            userName: userName || 'Misafir',
            message: message,
            type: 'incoming',
            timestamp: new Date()
        });

        const memory = getSessionMemory(sessionId);

        const chain = new ConversationChain({
            llm: model,
            memory: memory,
            prompt: createChatPrompt()
        });

        const response = await chain.call({
            input: message 
        });

        const aiMessage = response.response;

        // Store outgoing message
        messages.push({
            userId: userId || sessionId,
            userName: 'YZT Asistan',
            message: aiMessage,
            type: 'outgoing',
            timestamp: new Date()
        });

        // Try to extract reservation info
        const conversationHistory = await memory.loadMemoryVariables({});
        const historyText = JSON.stringify(conversationHistory);
        const reservationInfo = extractReservationInfo(historyText, message, aiMessage);
        
        // Check if we have enough info to create a reservation
        if (reservationInfo.date && reservationInfo.time && reservationInfo.partySize && reservationInfo.name) {
            // Check if reservation already exists
            const exists = reservations.some(r => 
                r.date === reservationInfo.date && 
                r.time === reservationInfo.time && 
                r.customer_name === reservationInfo.name
            );
            
            if (!exists) {
                const newReservation = {
                    date: reservationInfo.date,
                    time: reservationInfo.time,
                    table_number: reservationInfo.tableNumber || Math.floor(Math.random() * 10) + 1,
                    customer_name: reservationInfo.name,
                    party_size: reservationInfo.partySize,
                    special_requests: '',
                    timestamp: new Date()
                };
                reservations.push(newReservation);
                console.log('✅ Yeni rezervasyon oluşturuldu:', newReservation);
            }
        }

        res.json({ response: aiMessage });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
    const uniqueUsers = new Set(messages.map(m => m.userId)).size;
    res.json({
        totalReservations: reservations.length,
        totalMessages: messages.length,
        activeUsers: uniqueUsers
    });
});

// Messages endpoint
app.get('/api/messages', (req, res) => {
    const recentMessages = messages.slice(-50).reverse();
    res.json(recentMessages);
});

// Reservations endpoint
app.get('/api/reservations', (req, res) => {
    const sortedReservations = [...reservations].sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
    });
    res.json(sortedReservations);
});

// Cancel reservation endpoint
app.post('/api/reservation/cancel', (req, res) => {
    const { date, time, tableNumber } = req.body;
    
    const index = reservations.findIndex(r => 
        r.date === date && 
        r.time === time && 
        r.table_number === parseInt(tableNumber)
    );
    
    if (index !== -1) {
        reservations.splice(index, 1);
        res.json({ success: true, message: 'Rezervasyon iptal edildi' });
    } else {
        res.json({ success: false, message: 'Rezervasyon bulunamadı' });
    }
});

// Clear chat history endpoint
app.post('/api/clear', (req, res) => {
    const sessionId = req.session.id;
    sessionMemories.delete(sessionId);
    res.json({ message: 'Chat history cleared' });
});

app.listen(port, () => {
    console.log(`🌯 YZT Döner Rezervasyon Sistemi çalışıyor - Port: ${port}`);
    console.log(`📊 Dashboard: http://localhost:${port}`);
}); 