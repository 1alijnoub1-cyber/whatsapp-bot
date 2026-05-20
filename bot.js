const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const XLSX = require('xlsx');
const fs = require('fs');

const EXCEL_FILE = 'data.xlsx';
const SENT_SERIALS_FILE = 'sent_serials.json';

const ALLOWED_NUMBERS = [
    '964750xxxxxxx',
    '193759010680955',
];

let sentSerials = new Set();
if (fs.existsSync(SENT_SERIALS_FILE)) {
    sentSerials = new Set(JSON.parse(fs.readFileSync(SENT_SERIALS_FILE)));
}

function extractSerial(messageText) {
    const numbers = messageText.replace(/\D/g, '');
    if (numbers.length < 3) return null;
    return numbers.slice(0, -1);
}

function loadTokenMap() {
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
}

function saveSentSerials() {
    fs.writeFileSync(SENT_SERIALS_FILE, JSON.stringify([...sentSerials]));
}

const tokenMap = loadTokenMap();

const client = new Client({ 
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('📱 Scan this QR code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot is running');
});

client.on('message', async message => {
    if (message.isGroupMsg) return;
    
    const sender = message.from.replace('@c.us', '');
    
    if (!ALLOWED_NUMBERS.includes(sender)) {
        console.log(`❌ Unauthorized: ${sender}`);
        return;
    }
    
    const serial = extractSerial(message.body);
    
    if (!serial) {
        return;
    }
    
    if (sentSerials.has(serial)) {
        await message.reply(`⚠️ Serial ${serial} already used.`);
        return;
    }
    
    const token = tokenMap.get(serial);
    
    if (token) {
        await message.reply(`🔑 Token: ${token}`);
        sentSerials.add(serial);
        saveSentSerials();
        console.log(`✅ Sent to ${sender}`);
    }
});

client.initialize();
