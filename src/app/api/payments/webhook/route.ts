import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { addDays } from 'date-fns';

// Mercado Pago calls this endpoint automatically when a payment status changes.
// Configure the URL in your MP Dashboard > Your App > Webhooks:
//   https://yourdomain.com/api/payments/webhook
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // MP sends: { type: "payment", data: { id: "PAYMENT_ID" }, ... }
    if (body.type !== 'payment' || !body.data?.id) {
        return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentId = String(body.data.id);
    const { firestore } = initializeFirebase();

    // Get MP Access Token
    const settingsDoc = await getDoc(doc(firestore, 'platform_settings', 'main'));
    const mpAccessToken = settingsDoc.data()?.mpAccessToken;
    if (!mpAccessToken) {
        return NextResponse.json({ error: 'MP not configured' }, { status: 500 });
    }

    // Fetch payment from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    });

    if (!mpResponse.ok) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const mpData = await mpResponse.json();

    // Only process approved payments
    if (mpData.status !== 'approved') {
        return NextResponse.json({ received: true, status: mpData.status }, { status: 200 });
    }

    // external_reference format: "companyId|planId"
    const externalRef: string = mpData.external_reference || '';
    const [companyId, planId] = externalRef.split('|');

    if (!companyId) {
        console.error('Webhook: missing companyId in external_reference', externalRef);
        return NextResponse.json({ error: 'Invalid external_reference' }, { status: 400 });
    }

    // Fetch plan to get the correct duration
    let daysToAdd = 30;
    if (planId) {
        const planDoc = await getDoc(doc(firestore, 'plans', planId));
        if (planDoc.exists()) {
            const plan = planDoc.data();
            daysToAdd = plan.duration === 'trial' ? (plan.trialDays || 7) : 30;
        }
    }

    const subscriptionEndDate = addDays(new Date(), daysToAdd);

    // Update the company document
    const companyRef = doc(firestore, 'companies', companyId);
    await updateDoc(companyRef, {
        isActive: true,
        planId: planId || 'unknown',
        subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
    });

    console.log(`Webhook: company ${companyId} activated for ${daysToAdd} days (plan: ${planId})`);
    return NextResponse.json({ received: true, activated: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to MP so it doesn't keep retrying
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

// MP may also send GET requests to validate the webhook endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
