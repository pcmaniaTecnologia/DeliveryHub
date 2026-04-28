import { NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';
import { addDays } from 'date-fns';

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

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
    const { payment_id, companyId, idToken } = await req.json();
    if (!payment_id || !companyId) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Busca MP token: env var ou Firestore com idToken do usuário autenticado
    let mpAccessToken: string | undefined = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      const settings = await firestoreGet('platform_settings/main', idToken);
      mpAccessToken = settings?.mpAccessToken;
    }

    if (!mpAccessToken) {
      return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 400 });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${mpAccessToken}` },
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      return NextResponse.json({ error: 'Pagamento não encontrado no Mercado Pago.' }, { status: 404 });
    }

    const externalRef: string = mpData.external_reference || '';
    const [refCompanyId, planId] = externalRef.split('|');

    if (mpData.status === 'approved' && refCompanyId === companyId) {
      let daysToAdd = 30;
      let planName = 'Plano';

      if (planId) {
        const plan = await firestoreGet(`plans/${planId}`, idToken);
        if (plan) {
          planName = plan.name || 'Plano';
          daysToAdd = plan.duration === 'trial' ? (plan.trialDays || 7) : 30;
        }
      }

      const subscriptionEndDate = addDays(new Date(), daysToAdd);

      return NextResponse.json({
        approved: true,
        planName,
        planId,
        daysAdded: daysToAdd,
        subscriptionEndDate: subscriptionEndDate.toISOString(),
      });
    }

    return NextResponse.json({ approved: false, status: mpData.status });

  } catch (error: any) {
    console.error('[verify] Erro inesperado:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
