import { NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase-admin';
import { getPaymentUserId } from '@/lib/payment-auth';
import { getPlatformPaymentSettings } from '@/lib/mercado-pago';

async function isPlatformAdmin(request: Request) {
  const uid = await getPaymentUserId(request);
  if (!uid) return null;
  const role = await adminDb.collection('roles_admin').doc(uid).get();
  return role.exists ? uid : null;
}

export async function GET(request: Request) {
  try {
    if (!await isPlatformAdmin(request)) {
      return NextResponse.json({ error: 'Acesso restrito ao administrador da plataforma.' }, { status: 403 });
    }
    const settings = await getPlatformPaymentSettings();
    return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Could not load platform payment settings:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as configurações.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await isPlatformAdmin(request)) {
      return NextResponse.json({ error: 'Acesso restrito ao administrador da plataforma.' }, { status: 403 });
    }
    const body = await request.json();
    const pixKey = typeof body.pixKey === 'string' ? body.pixKey.trim() : '';
    const mpAccessToken = typeof body.mpAccessToken === 'string' ? body.mpAccessToken.trim() : '';
    const mpWebhookSecret = typeof body.mpWebhookSecret === 'string' ? body.mpWebhookSecret.trim() : '';

    const batch = adminDb.batch();
    batch.set(adminDb.collection('platform_public_settings').doc('main'), { pixKey }, { merge: true });
    const privateSettings: Record<string, unknown> = {
      mpAccessToken: mpAccessToken || admin.firestore.FieldValue.delete(),
      mpWebhookSecret: mpWebhookSecret || admin.firestore.FieldValue.delete(),
    };
    batch.set(adminDb.collection('platform_private_settings').doc('main'), privateSettings, { merge: true });
    batch.delete(adminDb.collection('platform_settings').doc('main'));
    await batch.commit();
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('Could not save platform payment settings:', error);
    return NextResponse.json({ error: 'Não foi possível salvar as configurações.' }, { status: 500 });
  }
}
