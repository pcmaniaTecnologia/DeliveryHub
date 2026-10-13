import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { toDirectoryCompany } from '@/lib/company-directory';

export const runtime = 'nodejs';

const getDirectory = unstable_cache(async () => {
  // Load inside the handler so configuration errors also return the controlled 503.
  const { adminDb } = await import('@/lib/firebase-admin');
  const snapshot = await adminDb.collection('companies').where('isActive', '==', true)
    .select('name', 'logoUrl', 'logoAdjustments', 'isActive', 'subscriptionEndDate', 'showcaseEnabled').get();
  return snapshot.docs.flatMap(doc => {
    const company = toDirectoryCompany(doc.id, doc.data());
    return company ? [company] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}, ['public-company-directory-v2'], { revalidate: 300 });

export async function GET() {
  try {
    return NextResponse.json({ companies: await getDirectory() });
  } catch (error) {
    console.error('Não foi possível carregar a vitrine de empresas:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as empresas. Tente novamente.' }, { status: 503 });
  }
}
