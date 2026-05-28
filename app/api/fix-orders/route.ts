import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        if (!adminDb) {
            return NextResponse.json({ success: false, message: 'Database adminDb not found' }, { status: 500 });
        }

        const companiesSnap = await adminDb.collection('companies').get();
        let fixedCount = 0;
        let checkedCount = 0;

        for (const companyDoc of companiesSnap.docs) {
            const ordersSnap = await adminDb.collection('companies').doc(companyDoc.id).collection('orders').get();
            
            for (const orderDoc of ordersSnap.docs) {
                checkedCount++;
                const orderData = orderDoc.data();
                
                if (!orderData.orderItems || !Array.isArray(orderData.orderItems)) continue;

                // Calcula o valor dos itens somando (Preço Unitário x Quantidade)
                const itemsTotal = orderData.orderItems.reduce((sum: number, item: any) => {
                    const priceToUse = item.finalPrice || item.unitPrice || 0;
                    const quantity = item.quantity || 1;
                    return sum + (priceToUse * quantity);
                }, 0);

                // Soma a taxa de entrega (se houver) para compor o Total do Pedido
                const finalCalculatedTotal = itemsTotal + (orderData.deliveryFee || 0);

                // Verifica se o total gravado no banco está errado (diferença maior que 1 centavo para ignorar erro de ponto flutuante)
                if (Math.abs((orderData.totalAmount || 0) - finalCalculatedTotal) > 0.01) {
                    await orderDoc.ref.update({
                        totalAmount: finalCalculatedTotal
                    });
                    fixedCount++;
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Verificação concluída! ${checkedCount} pedidos foram analisados e ${fixedCount} pedidos incorretos foram corrigidos com sucesso.` 
        });
    } catch (error: any) {
        console.error('Error fixing orders:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
