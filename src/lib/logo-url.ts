// Keep the same source in the editor, save validation and customer menu.
export function resolveLogoUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (['photos.app.goo.gl', 'photos.google.com', 'images.app.goo.gl'].includes(url.hostname)) {
      return `/api/extract-og-image?format=image&url=${encodeURIComponent(trimmed)}`;
    }
    if (url.hostname !== 'drive.google.com') return trimmed;
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
    if (!id || !/^[\w-]+$/.test(id)) return trimmed;
    const params = new URLSearchParams({ id });
    const resourceKey = url.searchParams.get('resourcekey');
    if (resourceKey) params.set('resourcekey', resourceKey);
    return `/api/drive-logo?${params}`;
  } catch {
    return trimmed;
  }
}
