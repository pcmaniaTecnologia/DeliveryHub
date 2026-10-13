import type { AppOptions, ServiceAccount } from 'firebase-admin';

// These variables must remain server-only; never use NEXT_PUBLIC for credentials.
export function getAdminOptions(
  env: Record<string, string | undefined>,
  cert: (account: ServiceAccount) => AppOptions['credential'],
): AppOptions {
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID || 'studio-516051115-a8e0e';
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (clientEmail || privateKey) {
    if (!clientEmail || !privateKey) {
      throw new Error('Configure FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY juntos no servidor.');
    }
    return { projectId, credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) };
  }
  // Firebase App Hosting and GOOGLE_APPLICATION_CREDENTIALS use default credentials.
  return { projectId };
}
