import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { admin } from '@/lib/firebase-admin';

/**
 * POST /api/stock/decrement
 * Body: { companyId: string, items: [{ productId: string, quantity: number }] }
 *
 * Decrementa o estoque usando Firebase Admin SDK (Server-side).
 * O Admin SDK ignora as firestore.rules, garantindo que a operação seja bem-sucedida.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyId, items } = body as {
      companyId: string;
      items: { productId: string; quantity: number }[];
    };

    if (!companyId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'companyId e items são obrigatórios' }, { status: 400 });
    }

    const updated: string[] = [];

    // Usamos um batch ou Promise.all para processar os itens
    await Promise.all(
      items.map(async ({ productId, quantity }) => {
        if (!productId || quantity <= 0) return;

        const productRef = adminDb.collection('companies').doc(companyId).collection('products').doc(productId);
        const snap = await productRef.get();

        if (!snap.exists) {
            console.log(`[stock/decrement] produto não encontrado: ${productId}`);
            return;
        }
        
        const data = snap.data();
        if (!data?.stockControlEnabled) {
            console.log(`[stock/decrement] controle de estoque desativado para: ${productId}`);
            return;
        }

        await productRef.update({ 
            stock: admin.firestore.FieldValue.increment(-quantity) 
        });
        updated.push(productId);
      })
    );

    console.log(`[stock/decrement-admin] company=${companyId} updated=[${updated.join(',')}]`);
    return NextResponse.json({ ok: true, updated }, { status: 200 });

  } catch (error: any) {
    console.error('[stock/decrement-admin] error:', error?.code, error?.message);
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar estoque' }, { status: 500 });
  }
}
