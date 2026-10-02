import type { Metadata } from 'next';
import MenuClient from './menu-client';
import { canIndexCompany, getPublicCompany, getSiteUrl } from '@/lib/company-seo';

export type { Product } from './menu-client';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ companyId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = await params;
  const company = await getPublicCompany(companyId);
  const index = canIndexCompany(company);
  const title = company?.name ? company.name + ' | Cardápio e pedidos online' : 'Cardápio | DeliveryHub';
  const description = company?.seoDescription || (company?.name ? 'Confira o cardápio de ' + company.name + ' e faça seu pedido online.' : 'Confira o cardápio e faça seu pedido online.');
  const siteUrl = getSiteUrl();
  const url = siteUrl ? siteUrl + '/menu/' + encodeURIComponent(companyId) : undefined;
  return {
    title, description,
    robots: { index, follow: index },
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: { title, description, type: 'website', locale: 'pt_BR', ...(url ? { url } : {}) },
  };
}

export default async function MenuPage({ params }: Props) {
  const { companyId } = await params;
  const company = await getPublicCompany(companyId);
  const siteUrl = getSiteUrl();
  const url = siteUrl ? siteUrl + '/menu/' + encodeURIComponent(companyId) : undefined;
  const structuredData = canIndexCompany(company) && company?.address ? {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: company.name,
    address: company.address,
    ...(company.seoDescription ? { description: company.seoDescription } : {}),
    ...(company.phone ? { telephone: company.phone } : {}),
    ...(company.logoUrl?.startsWith('https://') ? { image: company.logoUrl } : {}),
    ...(url ? { url, hasMenu: url } : {}),
  } : null;
  return <>
    {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />}
    <MenuClient />
  </>;
}
