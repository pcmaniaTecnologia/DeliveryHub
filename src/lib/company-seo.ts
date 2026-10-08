import { cache } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';
import { firebaseConfig } from '@/firebase/config';

// Menu metadata only needs a public document read, authorized by Firestore rules.
// Use a separate app so it never inherits a customer's authentication session.
function getPublicFirestore() {
  const appName = 'public-company-seo';
  const app = getApps().find(app => app.name === appName)
    ?? initializeApp(firebaseConfig, appName);
  return getFirestore(app);
}

export type PublicCompany = {
  name?: string;
  address?: string;
  seoDescription?: string;
  phone?: string;
  logoUrl?: string;
  isActive?: boolean;
  searchIndexingEnabled?: boolean;
};

export const getPublicCompany = cache(async (id: string): Promise<PublicCompany | null> => {
  if (!id || id.includes('/')) return null;
  try {
    const snapshot = await getDoc(doc(getPublicFirestore(), 'companies', id));
    return snapshot.exists() ? snapshot.data() as PublicCompany : null;
  } catch (error) {
    console.error('Não foi possível carregar informações públicas da empresa:', error);
    return null;
  }
});

export function getSiteUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return undefined;
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('NEXT_PUBLIC_SITE_URL deve ser uma URL HTTP ou HTTPS.');
  return url.origin;
}

export function canIndexCompany(company: PublicCompany | null): boolean {
  return !!company?.name && company.isActive === true && company.searchIndexingEnabled !== false;
}
