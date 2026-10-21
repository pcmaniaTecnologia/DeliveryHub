/** Prices and posted amounts are BRL cents; quantity may be fractional for weight. */
export const roundCurrency = (value: number) => {
    const [coefficient, exponent = '0'] = String(Number(value)).split('e');
    return Math.round(Number(`${coefficient}e${Number(exponent) + 2}`)) / 100;
};
export const sumCurrency = (values: number[]) => values.reduce((sum, value) => sum + Math.round(roundCurrency(value) * 100), 0) / 100;
export function pricedItemTotal(item: { finalPrice?: number; unitPrice?: number; quantity: number }, discount = 0) {
    return Math.max(0, roundCurrency(roundCurrency(item.finalPrice ?? item.unitPrice ?? 0) * item.quantity - roundCurrency(discount)));
}
