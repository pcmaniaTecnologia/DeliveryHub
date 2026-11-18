import { NextResponse } from 'next/server';
import { getPlatformPaymentSettings } from '@/lib/mercado-pago';

export async function GET() {
  try {
    const settings = await getPlatformPaymentSettings();
    return NextResponse.json({ pixKey: settings.pixKey }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Could not load public payment settings:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as opções de pagamento.' }, { status: 500 });
  }
}
