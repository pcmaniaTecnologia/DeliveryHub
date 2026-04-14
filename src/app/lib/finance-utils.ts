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

            // 1. Add cashier transaction
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

            // 2. Update session totals
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
};

/**
 * Internal helper to normalize and categorize payment methods.
 * High-precision version for DeliveryHub.
 */
function categorizePayment(method: string): 'cash' | 'pix' | 'credit' | 'debit' | null {
    if (!method) return null;
    const n = method.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    
    // PIX
    if (n.includes('pix')) return 'pix';
    
    // Cash / Dinheiro
    if (n.includes('dinheiro') || n.includes('especie') || n === 'din' || n.includes('dinherio') || n.includes('troco')) return 'cash';
    
    // Credit
    if (n.includes('credito') || n.includes('credit') || n.includes('c. cred') || n.includes('cc')) return 'credit';
    
    // Debit
    if (n.includes('debito') || n.includes('debit') || n.includes('c. deb') || n.includes('cd')) return 'debit';
    
    // Generic Card checks
    if (n.includes('cartao')) {
        if (n.includes('deb')) return 'debit';
        return 'credit'; // Default cartao to credit
    }

    if (n.startsWith('c.') || n.startsWith('cart')) {
        if (n.includes('deb')) return 'debit';
        if (n.includes('cred')) return 'credit';
    }
    
    return null;
}

/**
 * Parses a list of orders to calculate total sales by payment method.
 * Handles strings like "Pix (R$ 10,00), Dinheiro (R$ 5,00)" for multi-payments.
 */
export function parseSalesByPaymentMethod(orders: any[]): SalesByPaymentMethod {
    const acc = { cash: 0, pix: 0, credit: 0, debit: 0 };
    
    orders.forEach(order => {
        if (order.status === 'Cancelado') return;
        
        const paymentStr = (order.paymentMethod || '').trim();
        const orderTotal = Number(order.totalAmount) || 0;
        if (orderTotal <= 0) return;

        // NEW: Prioritize raw payment objects if they exist (Balcão/Comandas)
        if (Array.isArray(order.payments) && order.payments.length > 0) {
            order.payments.forEach((p: any) => {
                const cat = categorizePayment(p.method);
                const val = Number(p.amount) || 0;
                if (cat) acc[cat] += val;
                else acc.cash += val; // Fallback for unknown within objects
            });
            return;
        }

        if (!paymentStr) {
            // No string and no objects, default to first category (shouldn't happen)
            acc.cash += orderTotal;
            return;
        }

        // Stage 1: Normalize and Split
        // Split by common separators: |, ,, ;
        const parts = paymentStr.includes('|') 
            ? paymentStr.split(/\s*\|\s*/) 
            : paymentStr.split(/,\s*(?![0-9]{2}\))/); // Avoid splitting decimal commas

        const categorizedParts = parts.map(part => {
            const p = part.trim();
            if (!p) return null;

            // Stage 2: Extract Name and Amount from part
            const amountMatch = p.match(/(?:R\$\s*|[:(\s]\s*R\$\s*)([\d]+[.,][\d]{2}|[\d]+)/i);
            
            let amount: number | null = null;
            let methodName = p;

            if (amountMatch) {
                const rawAmount = amountMatch[1].replace(',', '.');
                const parsed = parseFloat(rawAmount);
                if (!isNaN(parsed) && parsed > 0) {
                    amount = parsed;
                    methodName = p.substring(0, amountMatch.index).trim().replace(/[:(]$/, '').trim();
                }
            }

            return { method: methodName, amount };
        }).filter(Boolean) as any[];

        // Stage 3: Categorize and accumulate
        if (categorizedParts.length === 1) {
            const cat = categorizePayment(categorizedParts[0].method) || 'cash';
            acc[cat] += orderTotal;
        } else {
            let distributedAmount = 0;
            let firstRecognizedCat: keyof typeof acc | null = null;
            
            categorizedParts.forEach(p => {
                const cat = categorizePayment(p.method);
                const val = p.amount !== null ? p.amount : 0;
                
                if (cat) {
                    acc[cat] += val;
                    distributedAmount += val;
                    if (!firstRecognizedCat) firstRecognizedCat = cat;
                }
            });

            // If we have parts but couldn't distribute the full total (e.g. regex failed for some amounts)
            // assign the difference to the first recognized category or cash
            if (distributedAmount < orderTotal - 0.01) {
                const diff = orderTotal - distributedAmount;
                const cat = firstRecognizedCat || categorizePayment(categorizedParts[0].method) || 'cash';
                acc[cat] += diff;
            }
        }
    });

    return acc;
}
