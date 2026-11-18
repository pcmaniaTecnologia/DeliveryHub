import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import { applyApprovedSubscriptionPayment } from '@/lib/subscription-payment';
import { getMercadoPagoAccessToken } from '@/lib/mercado-pago';

async function getMercadoPagoResource<T>(accessToken: string, path: string): Promise<T | null> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    console.error(`Mercado Pago resource lookup failed (${response.status}):`, path);
    return null;
  }
  return response.json() as Promise<T>;
}

function hasValidMercadoPagoSignature(req: Request, resourceId: string, configuredSecret?: string | null) {
  const secret = configuredSecret || process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signatureHeader = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(signatureHeader.split(',').map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }));
  if (!parts.ts || !parts.v1 || !requestId) return false;

  const manifest = `id:${resourceId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  let received: Buffer;
  try {
    received = Buffer.from(parts.v1, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const topic = String(body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
    const resourceId = String(body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
    if (!resourceId || !['payment', 'subscription_authorized_payment', 'subscription_preapproval'].includes(topic)) {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    const privateSettings = await adminDb.collection('platform_private_settings').doc('main').get();
    if (!hasValidMercadoPagoSignature(req, resourceId, privateSettings.data()?.mpWebhookSecret)) {
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 });
    }

    const accessToken = await getMercadoPagoAccessToken();
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

    if (topic === 'subscription_preapproval') {
      const subscription = await getMercadoPagoResource<any>(accessToken, `/preapproval/${encodeURIComponent(resourceId)}`);
      if (!subscription) return NextResponse.json({ error: 'Assinatura não encontrada.' }, { status: 502 });
      const [companyId, planId, source] = String(subscription.external_reference || '').split('|');
      if (companyId && planId && source === 'recurring') {
        await adminDb.collection('companies').doc(companyId).set({
          mercadoPagoSubscriptionId: String(subscription.id),
          mercadoPagoSubscriptionStatus: String(subscription.status || 'pending'),
          mercadoPagoSubscriptionPlanId: planId,
        }, { merge: true });
      }
      return NextResponse.json({ received: true, subscriptionStatus: subscription.status || null });
    }

    let companyId: string;
    let planId: string;
    let source: 'manual' | 'recurring';
    let paymentId: string;
    let amount: number;
    let subscriptionId: string | undefined;

    if (topic === 'subscription_authorized_payment') {
      const invoice = await getMercadoPagoResource<any>(accessToken, `/authorized_payments/${encodeURIComponent(resourceId)}`);
      if (!invoice) return NextResponse.json({ error: 'Fatura da assinatura não encontrada.' }, { status: 502 });
      if (invoice.payment?.status !== 'approved' || !invoice.payment?.id) {
        return NextResponse.json({ received: true, status: invoice.payment?.status || invoice.status || 'pending' });
      }

      subscriptionId = invoice.preapproval_id ? String(invoice.preapproval_id) : undefined;
      let reference = String(invoice.external_reference || '');
      if (!reference && subscriptionId) {
        const subscription = await getMercadoPagoResource<any>(accessToken, `/preapproval/${encodeURIComponent(subscriptionId)}`);
        reference = String(subscription?.external_reference || '');
      }
      [companyId, planId, source] = reference.split('|') as [string, string, 'manual' | 'recurring'];
      paymentId = String(invoice.payment.id);
      amount = Number(invoice.payment.transaction_amount ?? invoice.transaction_amount);
      if (source !== 'recurring') return NextResponse.json({ received: true, ignored: true });
    } else {
      const payment = await getMercadoPagoResource<any>(accessToken, `/v1/payments/${encodeURIComponent(resourceId)}`);
      if (!payment) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 502 });
      if (payment.status !== 'approved') return NextResponse.json({ received: true, status: payment.status || 'pending' });

      [companyId, planId, source] = String(payment.external_reference || '').split('|') as [string, string, 'manual' | 'recurring'];
      paymentId = String(payment.id);
      amount = Number(payment.transaction_amount);
      subscriptionId = payment.preapproval_id ? String(payment.preapproval_id) : undefined;
    }

    if (!companyId || !planId || !['manual', 'recurring'].includes(source)) {
      console.error('Webhook ignored payment with invalid external reference.');
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await applyApprovedSubscriptionPayment({
      paymentId,
      companyId,
      planId,
      amount,
      source,
      subscriptionId,
    });
    return NextResponse.json({ received: true, activated: true, alreadyProcessed: result.alreadyProcessed });
  } catch (error) {
    console.error('Mercado Pago webhook error:', error);
    // Return a failure so Mercado Pago can retry transient Firestore or API errors.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
