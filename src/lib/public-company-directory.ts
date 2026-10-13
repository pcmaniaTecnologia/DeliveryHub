import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore/lite';
import { firebaseConfig } from '@/firebase/config';
import { toDirectoryCompany } from './company-directory';

export async function loadPublicCompanyDirectory() {
  const appName = 'public-company-directory';
  const app = getApps().find(app => app.name === appName) ?? initializeApp(firebaseConfig, appName);
  const db = getFirestore(app);
  // Public index holds IDs only. Full company listings remain admin-only.
  const index = await getDocs(collection(db, 'companyShowcase'));
  const result = await Promise.all(index.docs.map(async entry => {
    const company = await getDoc(doc(db, 'companies', entry.id));
    return company.exists() ? toDirectoryCompany(company.id, company.data()) : null;
  }));
  return result.flatMap(company => company ? [company] : [])
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
