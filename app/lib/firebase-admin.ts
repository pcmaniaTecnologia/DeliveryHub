import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'studio-516051115-a8e0e',
    });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export { admin };
