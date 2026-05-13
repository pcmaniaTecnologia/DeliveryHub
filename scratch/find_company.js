
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
  "projectId": "studio-516051115-a8e0e",
  "appId": "1:1015702983462:web:374fbb40bad7916567a7e7",
  "apiKey": "AIzaSyASD5jGJn1T57_ZCi-I1_nKIidz9m-wO3s",
  "authDomain": "studio-516051115-a8e0e.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1015702983462"
};

async function findCompany() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    try {
        const q = query(collection(db, 'companies'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log('No companies found');
            return;
        }
        console.log('Found company ID:', snap.docs[0].id);
    } catch (e) {
        console.error('Error finding company:', e.message);
    }
}

findCompany();
