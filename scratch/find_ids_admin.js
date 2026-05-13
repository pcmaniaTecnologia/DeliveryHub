
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I hope this exists or I'll use default

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Try default first
        projectId: "studio-516051115-a8e0e"
    });
}

const db = admin.firestore();

async function findIds() {
    try {
        const companySnap = await db.collection('companies').limit(1).get();
        if (companySnap.empty) {
            console.log('No companies');
            return;
        }
        const companyId = companySnap.docs[0].id;
        console.log('Company ID:', companyId);

        const productSnap = await db.collection('companies').doc(companyId).collection('products').limit(1).get();
        if (productSnap.empty) {
            console.log('No products for company', companyId);
        } else {
            console.log('Product ID:', productSnap.docs[0].id);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

findIds();
