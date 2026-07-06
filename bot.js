const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Cria o cliente do WhatsApp com autenticação local (salva a sessão)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // Exibe o QR Code no terminal
    console.log('\n=============================================================');
    console.log('🤖 ESCANEIE O QR CODE ABAIXO PARA CONECTAR O ROBÔ DO WHATSAPP');
    console.log('=============================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Robô do WhatsApp conectado e pronto para responder!');
});

// Mapa para controlar as últimas mensagens e evitar spam duplo
// key: número do cliente, value: timestamp do último envio
const answeredUsers = new Map();

async function getBotConfig() {
    try {
        // Tenta buscar da API local caso esteja rodando o npm run dev
        let res = await fetch('http://localhost:8080/api/bot-config').catch(() => null);
        
        // Se a API local falhar, tenta buscar da API em produção
        if (!res || !res.ok) {
            res = await fetch('https://www.deliveryhub.online/api/bot-config').catch(() => null);
        }

        if (res && res.ok) {
            const data = await res.json();
            if (data.success && data.config) {
                return data.config;
            }
        }
    } catch (e) {
        console.error('Erro ao buscar configuração:', e);
    }
    return null;
}

client.on('message', async (msg) => {
    // Ignora mensagens enviadas pelo próprio robô, status ou de grupos
    if (msg.fromMe || msg.isStatus || msg.id.participant) return;

    const cooldownTime = 30 * 60 * 1000; 
    const now = Date.now();
    const lastAnswered = answeredUsers.get(msg.from);

    if (lastAnswered && (now - lastAnswered) < cooldownTime) {
        return; 
    }

    try {
        const config = await getBotConfig();

        if (!config) {
            // Se não encontrou configuração ativada, ignora
            return; 
        }

        const replyText = `${config.whatsappBotMessage}\n\n👉 ${config.whatsappBotLink}`;

        // Envia a resposta automática
        await client.sendMessage(msg.from, replyText);
        
        // Salva que respondeu agora
        answeredUsers.set(msg.from, now);
        
        console.log(`📩 Resposta enviada para o cliente: ${msg.from}`);

    } catch (error) {
        console.error('Erro ao processar mensagem do WhatsApp:', error);
    }
});

client.initialize();
