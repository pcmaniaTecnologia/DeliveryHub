import { adminDb } from '@/lib/firebase-admin';

export async function getPlatformPaymentSettings() {
  const publicRef = adminDb.collection('platform_public_settings').doc('main');
  const privateRef = adminDb.collection('platform_private_settings').doc('main');
  const legacyRef = adminDb.collection('platform_settings').doc('main');

  return adminDb.runTransaction(async transaction => {
    const [publicSnap, privateSnap, legacySnap] = await Promise.all([
      transaction.get(publicRef),
      transaction.get(privateRef),
      transaction.get(legacyRef),
    ]);
    const pixKey = publicSnap.data()?.pixKey || legacySnap.data()?.pixKey || null;
    const mpAccessToken = privateSnap.data()?.mpAccessToken || legacySnap.data()?.mpAccessToken || null;
    const mpWebhookSecret = privateSnap.data()?.mpWebhookSecret || null;

    if (legacySnap.exists) {
      if (pixKey) transaction.set(publicRef, { pixKey }, { merge: true });
      if (mpAccessToken) transaction.set(privateRef, { mpAccessToken }, { merge: true });
      transaction.delete(legacyRef);
    }

    return { pixKey, mpAccessToken, mpWebhookSecret };
  });
}

export async function getMercadoPagoAccessToken() {
  return (await getPlatformPaymentSettings()).mpAccessToken;
}
