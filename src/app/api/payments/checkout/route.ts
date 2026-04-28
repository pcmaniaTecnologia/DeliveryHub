import { NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Busca um documento do Firestore via REST API (sem SDK)
// Funciona para coleções públicas OU com ID token no header
async function firestoreGet(path: string, idToken?: string) {
  const headers: Record<string, string> = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  
  const res = await fetch(`${FIRESTORE_URL}/${path}`, { headers });
  if (!res.ok) return null;
  const json = await res.json();
  return parseFirestoreFields(json.fields);
}

function parseFirestoreFields(fields: any): any {
  if (!fields) return null;
  const result: any = {};
  for (const key of Object.keys(fields)) {
    const val = fields[key];
    if ('stringValue' in val) result[key] = val.stringValue;
    else if ('integerValue' in val) result[key] = Number(val.integerValue);
    else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
    else if ('booleanValue' in val) result[key] = val.booleanValue;
    else if ('mapValue' in val) result[key] = parseFirestoreFields(val.mapValue?.fields);
    else if ('arrayValue' in val) result[key] = (val.arrayValue?.values || []).map((v: any) => parseFirestoreFields(v));
    else result[key] = null;
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const { planId, companyId, idToken, baseUrl } = await req.json();
    console.log('[checkout] planId:', planId, 'companyId:', companyId, 'baseUrl:', baseUrl);

    if (!planId || !companyId) {
      return NextResponse.json({ error: 'Dados incompletos: planId e companyId são obrigatórios.' }, { status: 400 });
    }

    // 1. Busca o Access Token MP: primeiro env var, depois Firestore (com idToken do usuário autenticado)
    let mpAccessToken: string | undefined = process.env.MP_ACCESS_TOKEN;
    
    if (!mpAccessToken) {
      const settings = await firestoreGet('platform_settings/main', idToken);
      mpAccessToken = settings?.mpAccessToken;
    }

    console.log('[checkout] mpAccessToken presente:', !!mpAccessToken);

    if (!mpAccessToken) {
      return NextResponse.json({
        error: 'Mercado Pago não configurado. Adicione MP_ACCESS_TOKEN no .env.local ou configure no painel Admin.',
      }, { status: 400 });
    }

    // 2. Busca dados do plano (público ou com idToken)
    const plan = await firestoreGet(`plans/${planId}`, idToken);
    if (!plan) {
      return NextResponse.json({ error: `Plano "${planId}" não encontrado.` }, { status: 404 });
    }
    console.log('[checkout] Plano:', plan.name, 'Preço:', plan.price);

    const origin = baseUrl || req.headers.get('origin') || 'http://localhost:8080';

    const preferenceData = {
      items: [
        {
          id: planId,
          title: `Assinatura DeliveryHub - ${plan.name}`,
          description: `Acesso liberado por ${plan.duration === 'monthly' ? '30 dias' : 'período de teste'}.`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(plan.price),
        },
      ],
      external_reference: `${companyId}|${planId}`,
      back_urls: {
        success: `${origin}/dashboard/settings`,
        failure: `${origin}/dashboard/settings`,
        pending: `${origin}/dashboard/settings`,
      },
      auto_return: 'approved',
    };

    console.log('[checkout] preferenceData:', JSON.stringify(preferenceData, null, 2));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceData),
    });


    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[checkout] Erro Mercado Pago:', JSON.stringify(mpData));
      const mpMessage = mpData?.message || mpData?.error || JSON.stringify(mpData);
      return NextResponse.json({ error: `Mercado Pago: ${mpMessage}` }, { status: 500 });
    }

    console.log('[checkout] Preferência criada:', mpData.id);
    return NextResponse.json({ init_point: mpData.init_point });

  } catch (error: any) {
    console.error('[checkout] Erro inesperado:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
