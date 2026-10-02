import { cache } from 'react';
import { adminDb } from '@/lib/firebase-admin';

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
  try {
    const snapshot = await adminDb.collection('companies').doc(id).get();
    return snapshot.exists ? snapshot.data() as PublicCompany : null;
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
