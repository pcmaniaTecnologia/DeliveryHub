import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { payment_id, companyId } = await req.json();
    if (!payment_id || !companyId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const { firestore } = initializeFirebase();
    
    // get platform settings for access token
    const settingsDoc = await getDoc(doc(firestore, 'platform_settings', 'main'));
    const mpAccessToken = settingsDoc.data()?.mpAccessToken;
    
    if (!mpAccessToken) {
        return NextResponse.json({ error: 'Mercado Pago não configurado no painel Admin.' }, { status: 400 });
    }

    // verify payment in MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${mpAccessToken}`
        }
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (mpData.status === 'approved' && mpData.external_reference === companyId) {
        return NextResponse.json({ approved: true });
    }

    return NextResponse.json({ approved: false, status: mpData.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
