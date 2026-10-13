import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { loadPublicCompanyDirectory } from '@/lib/public-company-directory';

export const runtime = 'nodejs';

const getDirectory = unstable_cache(loadPublicCompanyDirectory,
  ['public-company-directory-v3'], { revalidate: 300 });

export async function GET() {
  try {
    return NextResponse.json({ companies: await getDirectory() });
  } catch (error) {
    console.error('Não foi possível carregar a vitrine de empresas:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as empresas. Tente novamente.' }, { status: 503 });
  }
}
