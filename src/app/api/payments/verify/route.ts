import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { addDays } from 'date-fns';

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

    // external_reference format: "companyId|planId"
    const externalRef: string = mpData.external_reference || '';
    const [refCompanyId, planId] = externalRef.split('|');

    if (mpData.status === 'approved' && refCompanyId === companyId) {
        // Fetch plan to get the correct duration
        let daysToAdd = 30; // fallback
        let planName = 'Plano';

        if (planId) {
            const planDoc = await getDoc(doc(firestore, 'plans', planId));
            if (planDoc.exists()) {
                const plan = planDoc.data();
                planName = plan.name || 'Plano';
                if (plan.duration === 'trial') {
                    daysToAdd = plan.trialDays || 7;
                } else {
                    daysToAdd = 30; // monthly
                }
            }
        }

        const subscriptionEndDate = addDays(new Date(), daysToAdd);

        // Save to Firestore server-side
        const companyRef = doc(firestore, 'companies', companyId);
        await updateDoc(companyRef, {
            isActive: true,
            planId: planId || 'unknown',
            subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
        });

        return NextResponse.json({
            approved: true,
            planName,
            daysAdded: daysToAdd,
            subscriptionEndDate: subscriptionEndDate.toISOString(),
        });
    }

    return NextResponse.json({ approved: false, status: mpData.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
