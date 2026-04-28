import { NextResponse } from 'next/server';
import { firebaseConfig } from '@/firebase/config';
import { addDays } from 'date-fns';

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const API_KEY = firebaseConfig.apiKey;

// Helper para buscar dados via REST
async function firestoreGet(path: string) {
  const res = await fetch(`${FIRESTORE_URL}/${path}?key=${API_KEY}`);
  if (!res.ok) return null;
  const json = await res.json();
  return parseFirestoreFields(json.fields);
}

// Helper para salvar dados via REST (PATCH)
async function firestoreUpdate(path: string, data: any) {
  const fields = Object.entries(data).reduce((acc: any, [key, value]) => {
    if (typeof value === 'string') acc[key] = { stringValue: value };
    else if (typeof value === 'number') acc[key] = { doubleValue: value };
    else if (typeof value === 'boolean') acc[key] = { booleanValue: value };
    else if (value instanceof Date) acc[key] = { timestampValue: value.toISOString() };
    return acc;
  }, {});

  const mask = Object.keys(data).map(key => `updateMask.fieldPaths=${key}`).join('&');
  const url = `${FIRESTORE_URL}/${path}?key=${API_KEY}&${mask}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  return res.ok;
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
    else if ('timestampValue' in val) result[key] = new Date(val.timestampValue);
    else if ('mapValue' in val) result[key] = parseFirestoreFields(val.mapValue?.fields);
    else if ('arrayValue' in val) result[key] = (val.arrayValue?.values || []).map((v: any) => parseFirestoreFields(v));
    else result[key] = null;
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentId = String(body.data.id);

    // 1. Busca Access Token (tenta env var primeiro, depois Firestore)
    let mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      const settings = await firestoreGet('platform_settings/main');
      mpAccessToken = settings?.mpAccessToken;
    }

    if (!mpAccessToken) {
      return NextResponse.json({ error: 'MP not configured' }, { status: 500 });
    }

    // 2. Busca o pagamento no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    });

    if (!mpResponse.ok) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const mpData = await mpResponse.json();

    if (mpData.status !== 'approved') {
      return NextResponse.json({ received: true, status: mpData.status }, { status: 200 });
    }

    // external_reference: "companyId|planId"
    const externalRef: string = mpData.external_reference || '';
    const [companyId, planId] = externalRef.split('|');

    if (!companyId) {
      return NextResponse.json({ error: 'Invalid external_reference' }, { status: 400 });
    }

    // 3. Calcula nova data
    let daysToAdd = 30;
    if (planId) {
      const plan = await firestoreGet(`plans/${planId}`);
      if (plan) {
        daysToAdd = plan.duration === 'trial' ? (plan.trialDays || 7) : 30;
      }
    }

    const subscriptionEndDate = addDays(new Date(), daysToAdd);

    // 4. Atualiza a empresa via REST API
    const ok = await firestoreUpdate(`companies/${companyId}`, {
      isActive: true,
      planId: planId || 'unknown',
      trialUsed: true,
      subscriptionEndDate: subscriptionEndDate,
    });

    if (!ok) {
        console.error(`Webhook: falha ao atualizar empresa ${companyId}`);
        return NextResponse.json({ error: 'Firestore update failed' }, { status: 500 });
    }

    console.log(`Webhook: empresa ${companyId} ativada por ${daysToAdd} dias.`);
    return NextResponse.json({ received: true, activated: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
