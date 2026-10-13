import * as admin from 'firebase-admin';
import { getAdminOptions } from './firebase-admin-options';

if (!admin.apps.length) {
    admin.initializeApp(getAdminOptions(process.env, admin.credential.cert));
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export { admin };
