const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');

// Inicializa o Firebase Admin para ler as configurações
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'studio-516051115-a8e0e',
    });
}
const db = admin.firestore();

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

client.on('message', async (msg) => {
    // Ignora mensagens enviadas pelo próprio robô, status ou de grupos
    if (msg.fromMe || msg.isStatus || msg.id.participant) return;

    // Tempo de espera para mandar o link de novo (ex: 30 minutos = 30 * 60 * 1000)
    // Isso evita que o robô mande o link de novo se o cliente mandar 3 áudios seguidos.
    const cooldownTime = 30 * 60 * 1000; 
    const now = Date.now();
    const lastAnswered = answeredUsers.get(msg.from);

    if (lastAnswered && (now - lastAnswered) < cooldownTime) {
        return; // Está no período de "silêncio", não envia nada de novo
    }

    try {
        // Busca a primeira empresa que tiver o bot ativado nas configurações
        const companiesSnapshot = await db.collection('companies')
            .where('whatsappBotEnabled', '==', true)
            .limit(1)
            .get();

        if (companiesSnapshot.empty) {
            // Nenhuma empresa ativou o robô nas configurações do painel
            return; 
        }

        const companyDoc = companiesSnapshot.docs[0];
        const config = companyDoc.data();

        const botLink = config.whatsappBotLink || `https://deliveryhub.com.br/menu/${companyDoc.id}`;
        const botMessage = config.whatsappBotMessage || 'Olá! Para fazer o seu pedido, acesse nosso cardápio digital clicando no link abaixo:';

        const replyText = `${botMessage}\n\n👉 ${botLink}`;

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
