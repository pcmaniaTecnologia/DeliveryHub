import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getPaymentUserId } from '@/lib/payment-auth';
import { applyApprovedSubscriptionPayment } from '@/lib/subscription-payment';
import { getMercadoPagoAccessToken } from '@/lib/mercado-pago';

export async function POST(req: Request) {
  try {
    const companyId = await getPaymentUserId(req);
    if (!companyId) return NextResponse.json({ error: 'Faça login novamente para continuar.' }, { status: 401 });

    const { payment_id: paymentId } = await req.json();
    if (!paymentId) return NextResponse.json({ error: 'Pagamento não informado.' }, { status: 400 });

    const mpAccessToken = await getMercadoPagoAccessToken();
    if (!mpAccessToken) return NextResponse.json({ error: 'Mercado Pago não configurado no painel Admin.' }, { status: 400 });

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) return NextResponse.json({ error: 'Não foi possível consultar este pagamento no Mercado Pago.' }, { status: 502 });

    const [referenceCompanyId, planId, source] = String(payment.external_reference || '').split('|');
    if (referenceCompanyId !== companyId || !planId || !['manual', 'recurring'].includes(source)) {
      return NextResponse.json({ error: 'O pagamento não corresponde a esta conta.' }, { status: 403 });
    }
    if (payment.status !== 'approved') {
      return NextResponse.json({ approved: false, status: payment.status });
    }

    const result = await applyApprovedSubscriptionPayment({
      paymentId: String(payment.id),
      companyId,
      planId,
      amount: Number(payment.transaction_amount),
      source: source as 'manual' | 'recurring',
      subscriptionId: payment.preapproval_id ? String(payment.preapproval_id) : undefined,
    });

    return NextResponse.json({
      approved: true,
      planName: (await adminDb.collection('plans').doc(planId).get()).data()?.name || 'Plano',
      subscriptionEndDate: result.subscriptionEndDate?.toISOString?.() || null,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ error: 'Não foi possível confirmar e aplicar o pagamento.' }, { status: 500 });
  }
}
