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

    const [mpAccessToken, planDoc, account, companyDoc] = await Promise.all([
      getMercadoPagoAccessToken(),
      adminDb.collection('plans').doc(String(planId)).get(),
      adminAuth.getUser(companyId),
      adminDb.collection('companies').doc(companyId).get(),
    ]);
    if (!mpAccessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no painel Admin.' }, { status: 400 });
    if (!planDoc.exists) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });
    if (!account.email) return NextResponse.json({ error: 'Cadastre um e-mail na sua conta antes de ativar a cobrança mensal.' }, { status: 400 });

    const plan = planDoc.data()!;
    const price = Number(plan.price);
    if (plan.duration === 'trial' || plan.billingType === 'per_order' || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Selecione um plano mensal pago válido.' }, { status: 400 });
    }

    const activeSubscriptionId = companyDoc.data()?.mercadoPagoSubscriptionId;
    if (typeof activeSubscriptionId === 'string' && activeSubscriptionId) {
      const existingResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(activeSubscriptionId)}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      if (existingResponse.ok) {
        const existing = await existingResponse.json();
        if (existing.status === 'authorized' || existing.status === 'pending') {
          return NextResponse.json({ error: 'Já existe uma cobrança mensal ativa ou aguardando aprovação. Você ainda pode escolher a renovação avulsa.' }, { status: 409 });
        }
      }
    }

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
    const subscriptionData = {
      reason: `Assinatura mensal DeliveryHub - ${plan.name}`,
      external_reference: `${companyId}|${planDoc.id}|recurring`,
      payer_email: account.email,
      back_url: `${origin}/dashboard/settings?subscription=return`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: price,
        currency_id: 'BRL',
      },
    };

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mpAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData),
    });
    const mpData = await mpResponse.json();
    if (!mpResponse.ok || !mpData.init_point || !mpData.id) {
      console.error('Mercado Pago subscription error:', mpData);
      return NextResponse.json({ error: 'Não foi possível criar a cobrança mensal no Mercado Pago.', details: mpData.message }, { status: 502 });
    }

    try {
      await adminDb.collection('companies').doc(companyId).set({
        mercadoPagoSubscriptionId: String(mpData.id),
        mercadoPagoSubscriptionStatus: mpData.status || 'pending',
        mercadoPagoSubscriptionPlanId: planDoc.id,
      }, { merge: true });
    } catch (saveError) {
      // The external reference still lets the verified webhook reconcile this subscription.
      console.error('Could not save Mercado Pago subscription id:', saveError);
    }

    return NextResponse.json({ init_point: mpData.init_point });
  } catch (error) {
    console.error('Recurring subscription checkout error:', error);
    return NextResponse.json({ error: 'Não foi possível iniciar a cobrança mensal.' }, { status: 500 });
  }
}
