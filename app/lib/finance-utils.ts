export function parseSalesByPaymentMethod(orders: any[]): SalesByPaymentMethod {
    const acc: SalesByPaymentMethod = { cash: 0, pix: 0, credit: 0, debit: 0 };

    orders.forEach((order: any) => {
        if (order.status === 'Cancelado') return;

        const paymentStr = String(order.paymentMethod || '').trim();
        const orderTotal = Number(order.totalAmount) || 0;
        if (orderTotal <= 0) return;

        // Prioriza objetos de pagamento, se existirem
        if (Array.isArray(order.payments) && order.payments.length > 0) {
            order.payments.forEach((p: any) => {
                const cat = categorizePayment(String(p.method || ''));
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

        // Stage 1: Normalize and Split
        const parts: string[] = paymentStr.includes('|')
            ? paymentStr.split(/\s*\|\s*/)
            : paymentStr.split(/,\s*(?![0-9]{2}\))/);

        // Stage 2: Extract Name and Amount from each part
        const categorizedParts: { method: string; amount: number | null }[] = parts
            .map((part: string): { method: string; amount: number | null } | null => {
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
                        methodName = p
                            .substring(0, amountMatch.index)
                            .trim()
                            .replace(/[:(]$/, '')
                            .trim();
                    }
                }

                return { method: methodName, amount };
            })
            .filter(
                (item): item is { method: string; amount: number | null } => item !== null
            );

        // Stage 3: Categorize and accumulate
        if (categorizedParts.length === 1) {
            const cat = categorizePayment(categorizedParts[0].method) || 'cash';
            acc[cat] += orderTotal;
        } else {
            let distributedAmount = 0;
            let firstRecognizedCat: keyof SalesByPaymentMethod | null = null;

            categorizedParts.forEach((p: { method: string; amount: number | null }) => {
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
                const cat =
                    firstRecognizedCat ||
                    categorizePayment(categorizedParts[0].method) ||
                    'cash';
                acc[cat] += diff;
            }
        }
    });

    return acc;
}