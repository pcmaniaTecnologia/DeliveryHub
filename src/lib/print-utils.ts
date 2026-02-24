import type { Order } from '@/app/dashboard/orders/page';

type Company = {
    id?: string;
    name?: string;
};

export function generateOrderPrintHtml(order: Order, company?: Company) {
    const itemsHtml = order.orderItems.map(item => {
        const groupedVariants: { [key: string]: { name: string; price: number }[] } = {};
        if (item.selectedVariants) {
            item.selectedVariants.forEach(v => {
                if (!groupedVariants[v.groupName]) groupedVariants[v.groupName] = [];
                groupedVariants[v.groupName].push({ name: v.itemName, price: v.price });
            });
        }

        const variantsText = Object.entries(groupedVariants).map(([group, items]) => {
            const itemsText = items.map(i => {
                const priceLabel = i.price > 0 ? ` (+R$${i.price.toFixed(2)})` : '';
                return `${i.name}${priceLabel}`;
            }).join(', ');
            return `<br><small style="color: #333; padding-left: 10px;"><strong>${group}:</strong> ${itemsText}</small>`;
        }).join('');
        
        const priceToUse = item.finalPrice || item.unitPrice;

        return `
            <tr>
                <td colspan="3" style="padding-top: 5px;">
                    <strong>${item.quantity}x ${item.productName || item.productId}</strong>
                    ${variantsText}
                    ${item.notes ? `<br><small style="color: #555; padding-left: 10px; font-style: italic;">OBS: ${item.notes}</small>` : ''}
                </td>
            </tr>
            <tr>
                <td style="padding-bottom: 5px;">&nbsp;</td>
                <td style="text-align: center; padding-bottom: 5px;">R$${priceToUse.toFixed(2)}</td>
                <td style="text-align: right; padding-bottom: 5px;">R$${(priceToUse * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const subtotal = order.totalAmount - (order.deliveryFee || 0);

    return `
        <html>
            <head>
                <title>Pedido ${order.id.substring(0,6).toUpperCase()}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 10pt; margin: 20px; color: #000; }
                    h2, p { margin: 0; text-align: center; }
                    h2 { font-size: 1.2em; }
                    hr { border: none; border-top: 1px dashed black; margin: 10px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 2px 0; }
                    th { text-align: left; border-bottom: 1px dashed black;}
                    .totals { text-align: right; margin-top: 10px; }
                    .totals strong { font-size: 1.1em; }
                    .section { margin-top: 15px; }
                    .section p { text-align: left; }
                    .section-title { font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>${company?.name || 'Seu Restaurante'}</h2>
                <p>Pedido: ${order.id.substring(0, 6).toUpperCase()}</p>
                <p>${order.orderDate.toDate().toLocaleString('pt-BR')}</p>
                <hr />
                <div class="section">
                    <p class="section-title">Cliente:</p>
                    <p>${order.customerName || 'Anônimo'}</p>
                    ${order.customerPhone ? `<p>Tel: ${order.customerPhone}</p>` : ''}
                    ${order.deliveryType === 'Delivery' ? `<p>${order.deliveryAddress}</p>` : ''}
                </div>
                <hr />
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align: center;">V. Unit</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <hr />
                <div class="totals">
                    <p>Subtotal: R$${subtotal.toFixed(2)}</p>
                    ${order.deliveryFee && order.deliveryFee > 0 ? `<p>Taxa de Entrega: R$${order.deliveryFee.toFixed(2)}</p>` : ''}
                    <strong>Total: R$${order.totalAmount.toFixed(2)}</strong>
                </div>
                 <hr />
                <p style="text-align: left;">Pagamento: ${order.paymentMethod}</p>
                <p style="text-align: left;">Entrega: ${order.deliveryType}</p>
                <script>
                    window.print();
                    window.onafterprint = () => window.close();
                </script>
            </body>
        </html>
    `;
}
