import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (!adminDb) {
            return NextResponse.json({ success: false, message: 'Database adminDb not found' }, { status: 500 });
        }

        const companiesSnap = await adminDb.collection('companies')
            .where('whatsappBotEnabled', '==', true)
            .limit(1)
            .get();

        if (companiesSnap.empty) {
            return NextResponse.json({ success: false, config: null });
        }

        const companyDoc = companiesSnap.docs[0];
        const config = companyDoc.data();

        return NextResponse.json({ 
            success: true, 
            config: {
                id: companyDoc.id,
                whatsappBotLink: config.whatsappBotLink || `https://www.deliveryhub.online/menu/${companyDoc.id}`,
                whatsappBotMessage: config.whatsappBotMessage || 'Olá! Para fazer o seu pedido, acesse nosso cardápio digital clicando no link abaixo:'
            }
        });
    } catch (error: any) {
        console.error('Error fetching bot config:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
