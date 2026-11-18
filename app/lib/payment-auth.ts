import { adminAuth } from '@/lib/firebase-admin';

export async function getPaymentUserId(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decodedToken = await adminAuth.verifyIdToken(match[1]);
    return decodedToken.uid;
  } catch {
    return null;
  }
}
