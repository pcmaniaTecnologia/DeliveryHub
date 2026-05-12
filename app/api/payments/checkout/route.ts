import { NextResponse } from 'next/server';
import { getServerFirestore } from '@/firebase/server';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { planId, companyId } = await req.json();
    if (!planId || !companyId) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const firestore = getServerFirestore();
    
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
    const price = Number(plan.price);

    if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: 'O plano selecionado possui um preço inválido.' }, { status: 400 });
    }

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
                unit_price: price
            }
        ],
        external_reference: `${companyId}|${planId}`,
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
        console.error("Mercado Pago Preference Error:", JSON.stringify(mpData, null, 2));
        return NextResponse.json({ 
            error: 'Erro ao gerar link de pagamento no Mercado Pago.', 
            details: mpData.message || 'Erro desconhecido',
            status: mpResponse.status 
        }, { status: 500 });
    }

    return NextResponse.json({ init_point: mpData.init_point });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error', msg: String(error) }, { status: 500 });
  }
}
