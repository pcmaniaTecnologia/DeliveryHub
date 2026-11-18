import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getPaymentUserId } from '@/lib/payment-auth';
import { getMercadoPagoAccessToken } from '@/lib/mercado-pago';

export async function POST(req: Request) {
  try {
    const companyId = await getPaymentUserId(req);
    if (!companyId) return NextResponse.json({ error: 'Faça login novamente para continuar.' }, { status: 401 });

    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: 'Selecione um plano.' }, { status: 400 });

    const [mpAccessToken, planDoc, account] = await Promise.all([
      getMercadoPagoAccessToken(),
      adminDb.collection('plans').doc(String(planId)).get(),
      adminAuth.getUser(companyId),
    ]);
    if (!mpAccessToken) {
      return NextResponse.json({ error: 'Mercado Pago não configurado no painel Admin.' }, { status: 400 });
    }
    if (!planDoc.exists) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });

    const plan = planDoc.data()!;
    const price = Number(plan.price);
    if (plan.duration === 'trial' || plan.billingType === 'per_order' || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Selecione um plano pago válido para renovar.' }, { status: 400 });
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
    const preferenceData = {
      items: [{
        id: planDoc.id,
        title: `Renovação DeliveryHub - ${plan.name}`,
        description: 'Pagamento avulso da mensalidade DeliveryHub.',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: price,
      }],
      payer: account.email ? { email: account.email } : undefined,
      external_reference: `${companyId}|${planDoc.id}|manual`,
      notification_url: `${origin}/api/payments/webhook`,
      back_urls: {
        success: `${origin}/dashboard/settings?checkout=success`,
        failure: `${origin}/dashboard/settings?checkout=failure`,
        pending: `${origin}/dashboard/settings?checkout=pending`,
      },
      auto_return: 'approved',
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mpAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preferenceData),
    });
    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Mercado Pago preference error:', mpData);
      return NextResponse.json({ error: 'Não foi possível gerar o pagamento avulso.', details: mpData.message }, { status: 502 });
    }

    return NextResponse.json({ init_point: mpData.init_point });
  } catch (error) {
    console.error('Payment checkout error:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar o pagamento.' }, { status: 500 });
  }
}
