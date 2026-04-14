import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
                totalSales: increment(amount)
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
 */
function categorizePayment(method: string): 'cash' | 'pix' | 'credit' | 'debit' | null {
    if (!method) return null;
    const n = method.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    
    if (n.includes('pix')) return 'pix';
    if (n.includes('dinheiro') || n.includes('especie') || n === 'din' || n.includes('dinherio') || n.includes('troco')) return 'cash';
    if (n.includes('credito') || n.includes('credit') || n.includes('c. cred') || n.includes('cc')) return 'credit';
    if (n.includes('debito') || n.includes('debit') || n.includes('c. deb') || n.includes('cd')) return 'debit';
    if (n.includes('cartao')) {
        if (n.includes('deb')) return 'debit';
        return 'credit';
    }
    if (n.startsWith('c.') || n.startsWith('cart')) {
        if (n.includes('deb')) return 'debit';
        if (n.includes('cred')) return 'credit';
    }
    return null;
}

/**
 * Parses a list of orders to calculate total sales by payment method.
 */
export function parseSalesByPaymentMethod(orders: any[]): SalesByPaymentMethod {
    const acc = { cash: 0, pix: 0, credit: 0, debit: 0 };
    orders.forEach(order => {
        if (order.status === 'Cancelado') return;
        const paymentStr = (order.paymentMethod || '').trim();
        const orderTotal = Number(order.totalAmount) || 0;
        if (orderTotal <= 0) return;

        if (Array.isArray(order.payments) && order.payments.length > 0) {
            order.payments.forEach((p: any) => {
                const cat = categorizePayment(p.method);
                const val = Number(p.amount) || 0;
                if (cat) acc[cat] += val;
                else acc.cash += val;
            });
            return;
        }

        if (!paymentStr) {
            acc.cash += orderTotal;
            return;
        }

        const parts = paymentStr.includes('|') 
            ? paymentStr.split(/\s*\|\s*/) 
            : paymentStr.split(/,\s*(?![0-9]{2}\))/);

        const categorizedParts: { method: string, amount: number | null }[] = parts.map(part => {
            const p = part.trim();
            if (!p) return null;
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
        }).filter(Boolean) as any;

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
            if (distributedAmount < orderTotal - 0.01) {
                const diff = orderTotal - distributedAmount;
                const cat = firstRecognizedCat || categorizePayment(categorizedParts[0].method) || 'cash';
                acc[cat] += diff;
            }
        }
    });
    return acc;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Verifica se a loja está aberta com base no JSON de horários.
 */
export function isStoreOpen(businessHoursStr?: string): { isOpen: boolean; message?: string } {
  if (!businessHoursStr) return { isOpen: true };
  
  try {
    const hours = JSON.parse(businessHoursStr);
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[now.getDay()];
    const config = hours[dayName];

    if (!config || !config.isOpen) {
      return { isOpen: false };
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = config.openTime.split(':').map(Number);
    const [closeH, closeM] = config.closeTime.split(':').map(Number);

    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (closeMinutes < openMinutes) {
        if (currentTime >= openMinutes || currentTime < closeMinutes) {
            return { isOpen: true };
        }
    } else {
        if (currentTime >= openMinutes && currentTime < closeMinutes) {
            return { isOpen: true };
        }
    }

    return { isOpen: false };
  } catch (e) {
    console.error("Erro ao validar horário:", e);
    return { isOpen: true }; 
  }
}
