import {
    collection,
    query,
    where,
    limit,
    getDocs,
    increment,
    serverTimestamp,
    doc
} from 'firebase/firestore';
import { addDocument, updateDocument } from '@/firebase';

/**
 * Records a sale in the currently open cashier session if one exists.
 */
export async function recordCashierSale(
    firestore: any,
    companyId: string,
    amount: number | string,
    description: string,
    orderId?: string,
    paymentMethod?: string
) {
    const numericAmount = Number(amount);
    if (!firestore || !companyId || isNaN(numericAmount)) {
        console.error('[Cashier] Invalid sale data:', { companyId, amount });
        return false;
    }

    try {
        const sessionsRef = collection(firestore, 'companies', companyId, 'cashier_sessions');
        const openSessionsQuery = query(sessionsRef, where('status', '==', 'open'), limit(1));
        const openSessionsSnap = await getDocs(openSessionsQuery);

        if (!openSessionsSnap.empty) {
            const sessionDoc = openSessionsSnap.docs[0];
            const sessionId = sessionDoc.id;

            const transactionsRef = collection(firestore, 'companies', companyId, 'cashier_transactions');
            await addDocument(transactionsRef, {
                sessionId,
                type: 'sale',
                amount: amount,
                description: description,
                timestamp: serverTimestamp(),
                orderId: orderId || null,
                paymentMethod: paymentMethod || null
            });

            const sessDocRef = doc(firestore, 'companies', companyId, 'cashier_sessions', sessionId);
            await updateDocument(sessDocRef, {
                totalSales: increment(numericAmount)
            });

            return { success: true, sessionId };
        }

        return { success: false };
    } catch (error) {
        console.error('[Cashier] Error recording sale:', error);
        return { success: false };
    }
}

export type SalesByPaymentMethod = {
    cash: number;
    pix: number;
    credit: number;
    debit: number;
    others: number;
};

/**
 * Internal helper to normalize and categorize payment methods.
 * High-precision version for DeliveryHub.
 */
function categorizePayment(method: string): 'cash' | 'pix' | 'credit' | 'debit' | null {
    if (!method) return null;

    const n = method
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // 1. PIX
    if (n === 'pix' || n.includes('pix')) return 'pix';

    // 2. DINHEIRO / ESPÉCIE
    if (
        n.includes('dinheiro') ||
        n.includes('especie') ||
        n === 'din' ||
        n === 'esp' ||
        n.includes('dinherio') ||
        n.includes('monetario') ||
        n.includes('cash') ||
        n.includes('cedula')
    ) {
        return 'cash';
    }

    // 3. DÉBITO
    if (
        n.includes('debito') ||
        n.includes('debit') ||
        n.includes('c. deb') ||
        n === 'cd' ||
        n.includes('visa d') ||
        n.includes('master d') ||
        n.includes('elo d') ||
        n.includes('cartao deb') ||
        n.includes('cartao de deb') ||
        n.includes('deb') // Catch-all for deb
    ) {
        return 'debit';
    }

    // 4. CRÉDITO
    if (
        n.includes('credito') ||
        n.includes('credit') ||
        n.includes('c. cred') ||
        n === 'cc' ||
        n.includes('visa c') ||
        n.includes('master c') ||
        n.includes('elo c') ||
        n.includes('cartao cre') ||
        n.includes('cartao de cre') ||
        n.includes('cre') // Catch-all for cre
    ) {
        return 'credit';
    }

    // 5. CARTÃO GENÉRICO
    if (n.includes('cartao') || n.startsWith('c.') || n.startsWith('cart')) {
        if (n.includes('deb')) return 'debit';
        if (n.includes('cre')) return 'credit';
        return 'credit';
    }

    return null;
}

/**
 * Parses a list of orders to calculate total sales by payment method.
 * Priority: uses `order.payments` array if present, falls back to parsing `order.paymentMethod` string.
 */
export function parseSalesByPaymentMethod(orders: any[]): SalesByPaymentMethod {
    const acc: SalesByPaymentMethod = { cash: 0, pix: 0, credit: 0, debit: 0, others: 0 };

    orders.forEach((order: any) => {
        if (order.status === 'Cancelado') return;

        const orderTotal = Number(order.totalAmount) || 0;
        if (orderTotal <= 0) return;

        // --- Priority path: use the structured payments array ---
        if (Array.isArray(order.payments) && order.payments.length > 0) {
            let distributed = 0;
            order.payments.forEach((p: any) => {
                const methodStr = String(p.method || '');
                const cat = categorizePayment(methodStr);
                const val = Number(p.amount) || 0;
                
                if (cat) {
                    acc[cat] += val;
                    distributed += val;
                } else {
                    // Se não reconhecer o método, joga em 'others'
                    acc.others += val;
                    distributed += val;
                    if (val > 0) {
                        console.warn(`[FinanceUtils] Valor R$ ${val} de "${methodStr}" atribuído a Outros. Order: ${order.id}`);
                    }
                }
            });

            // If rounding/calculation caused a small gap, put it in the first recognized category
            const diff = orderTotal - distributed;
            if (Math.abs(diff) > 0.01) {
                const firstCat = categorizePayment(String(order.payments[0]?.method || '')) || 'cash';
                acc[firstCat] += diff;
            }
            return;
        }

        // --- Fallback: parse the paymentMethod string ---
        const paymentStr = String(order.paymentMethod || '').trim();
        if (!paymentStr) {
            acc.others += orderTotal;
            return;
        }

        // Split by pipe (multi-payment PDV format) or comma (legacy)
        const rawParts: string[] = paymentStr.includes('|')
            ? paymentStr.split(/\s*\|\s*/)
            : paymentStr.split(/,\s*(?![0-9]{2}\))/);

        const parts = rawParts.map(raw => raw.trim()).filter(Boolean);

        if (parts.length === 1) {
            // Single payment — whole order total goes to this method
            const cat = categorizePayment(parts[0]) || 'cash';
            acc[cat] += orderTotal;
            return;
        }

        // Multi-payment string — extract method name and amount from each part.
        let distributed = 0;
        let firstCat: keyof SalesByPaymentMethod | null = null;

        parts.forEach(part => {
            // Remove typical non-amount notes, but keep the amount part.
            // If it's the Comandas format "Method (R$ Amount)", we don't want to strip the amount.
            // We only strip notes that DON'T contain R$ followed by numbers.
            const cleanPart = part.replace(/\((?!R\$\s*[\d])[^)]*\)/g, '').trim();
            
            // Match the amount: "Dinheiro: R$ 5.00" → 5.00
            // Handles both . and , as decimal separator
            const amountMatch = cleanPart.match(/R\$\s*([\d]+[.,][\d]{1,2}|[\d]+)/i);
            const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;
            
            // Extract method name (everything before ":" or "R$")
            const methodName = cleanPart.replace(/[:]\s*R\$.*$/, '').replace(/R\$.*$/, '').trim();
            const cat = categorizePayment(methodName);

            if (cat && amount !== null && amount > 0) {
                acc[cat] += amount;
                distributed += amount;
                if (!firstCat) firstCat = cat;
            } else if (cat) {
                // Method recognized but no amount — skip (will be handled by remainder logic)
                if (!firstCat) firstCat = cat;
            }
        });

        // If distributed amount doesn't match total (e.g., some parts had no parseable amount),
        // add remainder to the first recognized payment method
        if (Math.abs(distributed - orderTotal) > 0.01) {
            const cat = firstCat || 'others';
            acc[cat] += orderTotal - distributed;
            console.log(`[FinanceUtils] Diferença de R$ ${(orderTotal - distributed).toFixed(2)} atribuída a ${cat} no pedido ${order.id}`);
        }
    });

    return acc;
}