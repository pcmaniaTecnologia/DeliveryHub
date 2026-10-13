import { normalizeLogoAdjustments, type LogoAdjustments } from './logo-adjustments';

export type DirectoryCompany = { id: string; name: string; logoUrl: string | null; logoAdjustments: LogoAdjustments };

// Explicit allowlist: never return owner, payment, subscription or customer data.
export function toDirectoryCompany(id: string, data: Record<string, unknown>, now = Date.now()): DirectoryCompany | null {
  if (data.showcaseEnabled !== true || data.isActive !== true || typeof data.name !== 'string' || !data.name.trim()) return null;
  const expiry = data.subscriptionEndDate as { toMillis?: () => number } | undefined;
  if (typeof expiry?.toMillis === 'function' && expiry.toMillis() < now) return null;
  const logo = typeof data.logoUrl === 'string' ? data.logoUrl.trim() : '';
  const safeLogo = /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,|\/(?!\/))/i.test(logo) ? logo : null;
  return {
    id, name: data.name.trim(), logoUrl: safeLogo,
    logoAdjustments: normalizeLogoAdjustments(data.logoAdjustments as Partial<LogoAdjustments> | undefined),
  };
}

export function normalizeCompanySearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
