import { NextResponse } from 'next/server';

async function fetchSharedPage(source: string): Promise<Response> {
  let target = new URL(source);
  const hosts = ['photos.app.goo.gl', 'photos.google.com', 'images.app.goo.gl', 'drive.google.com', 'www.google.com', 'consent.google.com'];
  for (let count = 0; count < 6; count++) {
    if (target.protocol !== 'https:' || !hosts.includes(target.hostname) || target.port || target.username || target.password) throw new Error('Link de compartilhamento inválido.');
    const response = await fetch(target, {
      redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirecionamento inválido.');
    target = new URL(location, target);
  }
  throw new Error('Não foi possível abrir o link compartilhado.');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['photos.app.goo.gl', 'photos.google.com', 'images.app.goo.gl', 'drive.google.com'].includes(parsed.hostname)) {
      return NextResponse.json({ error: 'Use um link de compartilhamento do Google.' }, { status: 400 });
    }
    const response = await fetchSharedPage(url);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch the URL' }, { status: response.status });
    }

    const html = await response.text();
    
    // Look for og:image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);

    if (ogImageMatch && ogImageMatch[1]) {
      let imageUrl = ogImageMatch[1].replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
      // Photos' social preview crops the picture to 600x315. Keep the full logo.
      const photoImage = new URL(imageUrl);
      if (photoImage.hostname.endsWith('.googleusercontent.com')) {
        imageUrl = imageUrl.replace(/=w\d+-h\d+-p-k$/, '=w1000');
      }
      if (searchParams.get('format') === 'image') {
        const imageSource = new URL(imageUrl);
        if (imageSource.protocol !== 'https:' || !imageSource.hostname.endsWith('.googleusercontent.com')) {
          return NextResponse.json({ error: 'A página não disponibilizou uma foto.' }, { status: 422 });
        }
        const image = await fetch(imageSource, { signal: AbortSignal.timeout(10000), redirect: 'error' });
        const contentType = image.headers.get('content-type')?.split(';')[0] || '';
        if (!image.ok || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
          return NextResponse.json({ error: 'Imagem indisponível.' }, { status: 422 });
        }
        return new Response(image.body, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
      }
      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json({ error: 'No og:image found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
