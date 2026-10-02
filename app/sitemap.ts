import type { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import { canIndexCompany, getSiteUrl, type PublicCompany } from '@/lib/company-seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return [];
  const companies = await adminDb.collection('companies').where('isActive', '==', true).get();
  return companies.docs
    .filter(company => canIndexCompany(company.data() as PublicCompany))
    .map(company => ({
      url: `${siteUrl}/menu/${encodeURIComponent(company.id)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
}
