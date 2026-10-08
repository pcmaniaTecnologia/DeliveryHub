import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  const resourceKey = params.get('resourcekey');
  if (!id || !/^[\w-]{10,200}$/.test(id) || (resourceKey && !/^[\w-]{1,200}$/.test(resourceKey))) {
    return NextResponse.json({ error: 'Link do Drive inválido.' }, { status: 400 });
  }
  // Fetch only the public thumbnail from a fixed Google endpoint.
  const source = new URL('https://drive.google.com/thumbnail');
  source.searchParams.set('id', id);
  source.searchParams.set('sz', 'w1000');
  if (resourceKey) source.searchParams.set('resourcekey', resourceKey);
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    if (!response.ok || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) {
      return NextResponse.json({ error: 'Imagem indisponível. No Drive, permita acesso a qualquer pessoa com o link.' }, { status: 422 });
    }
    return new Response(response.body, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar a imagem do Drive.' }, { status: 502 });
  }
}
