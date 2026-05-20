const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');
const fs = require('fs');

// ========== إعدادات البوت ==========
const EXCEL_FILE = 'data.xlsx';
const SENT_SERIALS_FILE = 'sent_serials.json';

// قائمة الأرقام المسموحة - أضف أرقامك هنا
const ALLOWED_NUMBERS = [
    '964750xxxxxxx',     // استبدل برقمك
    '193759010680955',   // استبدل برقمك
];

// تحميل السيريالات المرسلة مسبقاً
let sentSerials = new Set();
if (fs.existsSync(SENT_SERIALS_FILE)) {
    try {
        sentSerials = new Set(JSON.parse(fs.readFileSync(SENT_SERIALS_FILE)));
    } catch(e) {}
}

// دالة استخراج السيريال من الرسالة
function extractSerial(messageText) {
    const numbers = messageText.replace(/\D/g, '');
    if (numbers.length < 3) return null;
    return numbers.slice(0, -1);
}

// تحميل البيانات من الاكسل
function loadTokenMap() {
    try {
        const workbook = XLSX.readFile(EXCEL_FILE);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        const tokenMap = new Map();
        
        for (const row of rows) {
            const serial1 = row['serial']?.toString().trim();
            const token1 = row['token']?.toString().trim();
            const serial2 = row['serial2']?.toString().trim();
            const token2 = row['token2']?.toString().trim();
            
            if (serial1 && token1 && !tokenMap.has(serial1)) {
                tokenMap.set(serial1, token1);
            }
            if (serial2 && token2 && !tokenMap.has(serial2)) {
                tokenMap.set(serial2, token2);
            }
        }
        
        console.log(`Loaded ${tokenMap.size} serials from Excel file`);
        return tokenMap;
    } catch(e) {
        console.error('Error loading Excel:', e.message);
        return new Map();
    }
}

// حفظ السيريالات المرسلة
function saveSentSerials() {
    fs.writeFileSync(SENT_SERIALS_FILE, JSON.stringify([...sentSerials]));
}

// ========== إعدادات Chromium لحل مشكلة Railway ==========
const chromiumPath = process.env.CHROME_BIN || '/usr/bin/chromium-browser';

const client = new Client({ 
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: chromiumPath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});
// ============================================================

// تشغيل البوت
const tokenMap = loadTokenMap();

client.on('qr', qr => {
    console.log('📱 Scan this QR code with WhatsApp (Settings > Linked Devices)');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot is running');
});

client.on('message', async message => {
    if (message.isGroupMsg) return;
    
    const sender = message.from.replace('@c.us', '');
    
    if (!ALLOWED_NUMBERS.includes(sender)) {
        console.log(`❌ Unauthorized number: ${sender}`);
        return;
    }
    
    const serial = extractSerial(message.body);
    
    if (!serial) {
        console.log(`⚠️ No valid serial found`);
        return;
    }
    
    if (sentSerials.has(serial)) {
        console.log(`♻️ Duplicate serial: ${serial}`);
        await message.reply(`⚠️ Sorry, serial ${serial} has already been used.`);
        return;
    }
    
    const token = tokenMap.get(serial);
    
    if (token) {
        await message.reply(`🔑 Token for serial [${serial}]:\n${token}`);
        sentSerials.add(serial);
        saveSentSerials();
        console.log(`✅ Token sent to ${sender} | Serial: ${serial}`);
    } else {
        console.log(`❌ Serial not found: ${serial}`);
    }
});

client.initialize();
