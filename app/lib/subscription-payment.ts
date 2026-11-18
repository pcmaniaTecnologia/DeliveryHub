import { addMonths } from 'date-fns';
import { admin, adminDb } from '@/lib/firebase-admin';

type PaymentSource = 'manual' | 'recurring';

function setBillingDay(date: Date, billingDay: number) {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    Math.min(billingDay, lastDayOfMonth),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function getNextFixedExpiry(currentEndDate: Date | null, now: Date, billingDay: number) {
  const anchor = currentEndDate || now;
  if (anchor > now) return setBillingDay(addMonths(anchor, 1), billingDay);

  const monthDistance = (now.getFullYear() - anchor.getFullYear()) * 12 + now.getMonth() - anchor.getMonth();
  let nextExpiry = setBillingDay(addMonths(anchor, Math.max(1, monthDistance)), billingDay);
  if (nextExpiry <= now) nextExpiry = setBillingDay(addMonths(nextExpiry, 1), billingDay);
  return nextExpiry;
}

export async function applyApprovedSubscriptionPayment(input: {
  paymentId: string;
  companyId: string;
  planId: string;
  amount: number;
  source: PaymentSource;
  subscriptionId?: string;
}) {
  const { paymentId, companyId, planId, amount, source, subscriptionId } = input;
  if (!paymentId || !companyId || !planId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Dados de pagamento inválidos.');
  }

  const companyRef = adminDb.collection('companies').doc(companyId);
  const planRef = adminDb.collection('plans').doc(planId);
  const [companySnap, planSnap] = await Promise.all([companyRef.get(), planRef.get()]);
  if (!companySnap.exists) throw new Error('Empresa do pagamento não encontrada.');
  if (!planSnap.exists) throw new Error('Plano do pagamento não encontrado.');

  const plan = planSnap.data()!;
  const expectedAmount = Number(plan.price);
  if (plan.duration === 'trial' || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    throw new Error('Plano não é uma assinatura paga.');
  }
  if (Math.abs(amount - expectedAmount) > 0.01) {
    throw new Error('Valor aprovado diferente do valor do plano.');
  }

  const paymentRef = adminDb.collection('subscription_payments').doc(paymentId);
  return adminDb.runTransaction(async transaction => {
    const [processedPayment, currentCompany] = await Promise.all([
      transaction.get(paymentRef),
      transaction.get(companyRef),
    ]);
    if (processedPayment.exists) {
      return { alreadyProcessed: true, subscriptionEndDate: currentCompany.data()?.subscriptionEndDate?.toDate?.() ?? null };
    }
    if (!currentCompany.exists) throw new Error('Empresa do pagamento não encontrada.');

    const now = new Date();
    const companyData = currentCompany.data()!;
    const storedEndDate = companyData.subscriptionEndDate?.toDate?.();
    const currentEndDate = storedEndDate instanceof Date ? storedEndDate : null;
    const startsPaidPlan = !companyData.planId || companyData.planId === 'trial';
    const billingAnchor = startsPaidPlan && (!currentEndDate || currentEndDate <= now) ? null : currentEndDate;
    const storedBillingDay = Number(companyData.subscriptionBillingDay);
    const billingDay = Number.isInteger(storedBillingDay) && storedBillingDay >= 1 && storedBillingDay <= 31
      ? storedBillingDay
      : billingAnchor?.getDate() ?? now.getDate();
    const subscriptionEndDate = getNextFixedExpiry(billingAnchor, now, billingDay);

    transaction.update(companyRef, {
      isActive: true,
      planId,
      trialUsed: true,
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(subscriptionEndDate),
      subscriptionBillingDay: billingDay,
      ...(subscriptionId ? { mercadoPagoSubscriptionId: subscriptionId } : {}),
    });
    transaction.create(paymentRef, {
      companyId,
      planId,
      amount,
      source,
      subscriptionId: subscriptionId || null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { alreadyProcessed: false, subscriptionEndDate };
  });
}
