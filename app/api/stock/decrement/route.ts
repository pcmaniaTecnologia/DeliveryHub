import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

/**
 * POST /api/stock/decrement
 * Body: { companyId: string, items: [{ productId: string, quantity: number }] }
 *
 * Decrementa o estoque usando Firebase Client SDK no Servidor.
 * Como o servidor roda de forma "anônima", as firestore.rules precisam permitir o decremento.
 */

function getServerFirestore() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

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

    const firestore = getServerFirestore();
    const updated: string[] = [];

    await Promise.all(
      items.map(async ({ productId, quantity }) => {
        if (!productId || quantity <= 0) return;

        const productRef = doc(firestore, 'companies', companyId, 'products', productId);
        const snap = await getDoc(productRef);

        if (!snap.exists()) {
            console.log(`[stock/decrement] produto não encontrado: ${productId}`);
            return;
        }
        
        const data = snap.data();
        if (!data?.stockControlEnabled) {
            console.log(`[stock/decrement] controle de estoque desativado para: ${productId}`);
            return;
        }

        await updateDoc(productRef, { stock: increment(-quantity) });
        updated.push(productId);
      })
    );

    console.log(`[stock/decrement-fallback] company=${companyId} updated=[${updated.join(',')}]`);
    return NextResponse.json({ ok: true, updated }, { status: 200 });

  } catch (error: any) {
    console.error('[stock/decrement-fallback] error:', error?.code, error?.message);
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar estoque' }, { status: 500 });
  }
}
