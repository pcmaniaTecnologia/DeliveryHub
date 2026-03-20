import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { planId, companyId } = await req.json();
    if (!planId || !companyId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const { firestore } = initializeFirebase();
    
    // get platform settings for access token
    const settingsDoc = await getDoc(doc(firestore, 'platform_settings', 'main'));
    const mpAccessToken = settingsDoc.data()?.mpAccessToken;
    
    if (!mpAccessToken) {
        return NextResponse.json({ error: 'Mercado Pago não configurado no painel Admin.' }, { status: 400 });
    }

    // get plan details
    const planDoc = await getDoc(doc(firestore, 'plans', planId));
    if (!planDoc.exists()) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    const plan = planDoc.data();

    // Create Preference in MP
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    
    const preferenceData = {
        items: [
            {
                id: plan.id,
                title: `Assinatura DeliveryHub - ${plan.name}`,
                description: `Acesso liberado por ${plan.duration === 'monthly' ? '30 dias' : 'teste'}.`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number(plan.price)
            }
        ],
        external_reference: companyId,
        back_urls: {
            success: `${origin}/dashboard/settings?checkout=success`,
            failure: `${origin}/dashboard/settings?checkout=failure`,
            pending: `${origin}/dashboard/settings?checkout=pending`
        },
        auto_return: 'approved'
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceData)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("MP Error:", mpData);
        return NextResponse.json({ error: 'Failed to create preference' }, { status: 500 });
    }

    return NextResponse.json({ init_point: mpData.init_point });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
