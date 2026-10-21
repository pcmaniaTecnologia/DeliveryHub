import { pricedItemTotal, sumCurrency } from './currency';

export type FinalizedOrder = {
    id: string;
    status: string;
    deliveryType?: string;
    tableNumber?: string;
    customerName?: string;
    orderDate?: any;
    totalAmount: number;
    paymentMethod?: string;
    payments?: { method: string; amount: number }[];
    notes?: string;
    cashierRecorded?: boolean;
    orderItems?: { productName?: string; productId?: string; quantity: number; unitPrice: number; finalPrice?: number; notes?: string; selectedVariants?: { itemName: string }[] }[];
};
type Movement = { type: string; orderId?: string; sessionId?: string; amount: number; paymentMethod?: string; timestamp?: any };
export type FinalizedComanda = { id: string; tableNumber: string; orders: FinalizedOrder[]; paidAt?: number; total: number; payments?: { method: string; amount: number }[] };
const millis = (value: any): number => value?.toMillis?.() || value?.getTime?.() || 0;
const paymentNote = (order: FinalizedOrder) => order.notes?.match(/Pagamentos: (.*)$/)?.[1];

export function groupFinalizedComandas(orders: FinalizedOrder[], movements: Movement[]): FinalizedComanda[] {
    const finished = orders.filter(o => ['Entregue', 'Finalizado'].includes(o.status) && (o.deliveryType === 'Mesa' || o.tableNumber));
    const receipts: FinalizedComanda[] = [];
    const assigned = new Set<string>();
    const byId = new Map(finished.map(o => [o.id, o]));
    const sales = movements.filter(m => m.type === 'sale' && m.orderId && byId.has(m.orderId));
    const exactGroups = new Map<string, FinalizedOrder[]>();

    // The current checkout stores all per-order receipts in one transaction,
    // so their server timestamps identify one closure without guessing by table.
    for (const order of finished) {
        if (!order.cashierRecorded) continue;
        const movement = sales.find(m => m.orderId === order.id && millis(m.timestamp));
        if (!movement) continue;
        const key = `${order.tableNumber}|${movement.sessionId}|${millis(movement.timestamp)}`;
        exactGroups.set(key, [...(exactGroups.get(key) || []), order]);
    }
    for (const [id, grouped] of exactGroups) {
        grouped.forEach(o => assigned.add(o.id));
        receipts.push({ id, tableNumber: String(grouped[0].tableNumber || 'Sem número'), orders: grouped,
            paidAt: millis(sales.find(m => m.orderId === grouped[0].id)?.timestamp), total: sumCurrency(grouped.map(o => o.totalAmount)),
            payments: sales.filter(m => grouped.some(o => o.id === m.orderId)).map(m => ({ method: m.paymentMethod || 'Não informado', amount: m.amount })) });
    }

    // Legacy closures put one combined receipt on the first order. Group only
    // when its original payment note and the full receipt amount both agree.
    const anchors = [...new Set(sales.map(m => m.orderId!))].sort((a,b) =>
        millis(sales.find(m => m.orderId === a)?.timestamp) - millis(sales.find(m => m.orderId === b)?.timestamp));
    for (const id of anchors) {
        const anchor = byId.get(id)!;
        if (assigned.has(id)) continue;
        const entries = sales.filter(m => m.orderId === id);
        const paidAt = Math.max(...entries.map(m => millis(m.timestamp)));
        const note = paymentNote(anchor);
        const candidates = note ? finished.filter(o => !assigned.has(o.id) && String(o.tableNumber) === String(anchor.tableNumber)
            && paymentNote(o) === note && millis(o.orderDate) <= paidAt) : [anchor];
        const receiptTotal = sumCurrency(entries.map(m => m.amount));
        const candidateTotal = sumCurrency(candidates.map(o => o.totalAmount));
        const grouped = candidates.some(o => o.id === id) && Math.round(candidateTotal * 100) === Math.round(receiptTotal * 100) ? candidates : [anchor];
        grouped.forEach(o => assigned.add(o.id));
        receipts.push({ id, tableNumber: String(anchor.tableNumber || 'Sem número'), orders: grouped, paidAt, total: sumCurrency(grouped.map(o => o.totalAmount)),
            payments: grouped === candidates ? entries.map(m => ({ method: m.paymentMethod || 'Não informado', amount: m.amount })) : undefined });
    }
    for (const order of finished) {
        if (!assigned.has(order.id)) receipts.push({ id: order.id, tableNumber: String(order.tableNumber || 'Sem número'), orders: [order], total: sumCurrency([order.totalAmount]) });
    }
    return receipts.sort((a,b) => (b.paidAt || millis(b.orders[0].orderDate)) - (a.paidAt || millis(a.orders[0].orderDate)));
}

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function generateFinalizedComandaHtml(receipt: FinalizedComanda, companyName: string, isReprint = true) {
    const customers = [...new Set(receipt.orders.map(o => o.customerName).filter(Boolean))].join(', ');
    const payments = new Map<string, number>();
    const recordedPayments = receipt.payments || receipt.orders.flatMap(order => order.payments || []);
    for (const payment of recordedPayments) payments.set(payment.method, sumCurrency([payments.get(payment.method) || 0, payment.amount]));
    const paymentsMatch = Math.round(sumCurrency([...payments.values()]) * 100) === Math.round(receipt.total * 100);
    const paymentHtml = payments.size && paymentsMatch ? [...payments].map(([method, amount]) => `<p>${escape(method)}: ${money(amount)}</p>`).join('')
        : `<p>${escape([...new Set(receipt.orders.map(o => o.paymentMethod).filter(Boolean))].join(' | ') || 'Forma de pagamento não informada')}</p>`;
    const rows = receipt.orders.flatMap(order => (order.orderItems || []).map(item => `<tr><td>${escape(item.quantity)}x ${escape(item.productName || item.productId)}
        ${item.selectedVariants?.length ? `<small>${escape(item.selectedVariants.map(v => v.itemName).join(', '))}</small>` : ''}
        ${item.notes ? `<small>Obs.: ${escape(item.notes)}</small>` : ''}</td><td>${money(pricedItemTotal(item))}</td></tr>`)).join('');
    const itemTotal = sumCurrency(receipt.orders.flatMap(o => (o.orderItems || []).map(item => pricedItemTotal(item))));
    const discount = sumCurrency([itemTotal, -receipt.total]);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${isReprint ? 'Reimpressão' : 'Comprovante'} — Mesa ${escape(receipt.tableNumber)}</title>
        <style>body{font:14px 'Courier New',monospace;color:#000;max-width:76mm;margin:12px auto}h1{font-size:18px;text-align:center}h2{font-size:16px;text-align:center}p{margin:5px 0}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px dashed #777;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}small{display:block}hr{border:0;border-top:1px dashed #000}.total{font-size:18px;font-weight:bold}.center{text-align:center}@media print{body{margin:0;max-width:none}}</style></head><body>
        <h1>${escape(companyName)}</h1><h2>${isReprint ? 'COMANDA FINALIZADA — REIMPRESSÃO' : 'COMPROVANTE DE PAGAMENTO'}</h2><p>Mesa ${escape(receipt.tableNumber)}</p>
        ${customers ? `<p>Cliente: ${escape(customers)}</p>` : ''}
        <p>${receipt.paidAt ? 'Pagamento' : 'Pedido'}: ${new Date(receipt.paidAt || millis(receipt.orders[0].orderDate)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
        <p>Pedidos: ${escape(receipt.orders.map(o => o.id.slice(0,6).toUpperCase()).join(', '))}</p><hr><table>${rows}</table>
        ${discount > 0 ? `<p>Descontos: ${money(discount)}</p>` : ''}<p class="total">Total pago: ${money(receipt.total)}</p><hr>${paymentHtml}
        <p class="center">Não é documento fiscal.</p></body></html>`;
}
