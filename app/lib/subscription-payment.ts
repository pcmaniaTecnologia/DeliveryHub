import { addDays } from 'date-fns';
import { admin, adminDb } from '@/lib/firebase-admin';

type PaymentSource = 'manual' | 'recurring';

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
    const currentEndDate = currentCompany.data()?.subscriptionEndDate?.toDate?.();
    const baseDate = currentEndDate instanceof Date && currentEndDate > now ? currentEndDate : now;
    const subscriptionEndDate = addDays(baseDate, 30);

    transaction.update(companyRef, {
      isActive: true,
      planId,
      trialUsed: true,
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(subscriptionEndDate),
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
