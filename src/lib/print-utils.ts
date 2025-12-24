
import type { Order } from '@/app/dashboard/orders/page';

type Company = {
    id?: string;
    name?: string;
};

export function generateOrderPrintHtml(order: Order, company?: Company) {
    const itemsHtml = order.orderItems.map(item => `
        <tr>
            <td colspan="3" style="padding-top: 5px;">
                ${item.productName || item.productId}
                ${item.notes ? `<br><small style="color: #555; padding-left: 10px;">OBS: ${item.notes}</small>` : ''}
            </td>
        </tr>
        <tr>
            <td style="padding-bottom: 5px;">&nbsp;</td>
            <td style="text-align: center; padding-bottom: 5px;">${item.quantity} x R$${item.unitPrice.toFixed(2)}</td>
            <td style="text-align: right; padding-bottom: 5px;">R$${(item.unitPrice * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

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
                    <p>${order.customerName || 'Cliente anônimo'}</p>
                    ${order.customerPhone ? `<p>Tel: ${order.customerPhone}</p>` : ''}
                    ${order.deliveryType === 'Delivery' ? `<p>${order.deliveryAddress}</p>` : ''}
                </div>
                <hr />
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align: center;">Qtd x Valor</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <hr />
                ${order.notes ? `<div class="section"><p class="section-title">Observações do Pedido:</p><p>${order.notes}</p></div><hr />` : ''}
                <div class="totals">
                    <p>Subtotal: R$${order.totalAmount.toFixed(2)}</p>
                    ${order.deliveryFee ? `<p>Taxa de Entrega: R$${order.deliveryFee.toFixed(2)}</p>` : ''}
                    <strong>Total: R$${(order.totalAmount + (order.deliveryFee || 0)).toFixed(2)}</strong>
                </div>
                 <hr />
                <p style="text-align: left;">Forma de Pagamento: ${order.paymentMethod}</p>
                <p style="text-align: left;">Tipo de Entrega: ${order.deliveryType}</p>
                
                <script>
                    window.print();
                    window.onafterprint = () => window.close();
                </script>
            </body>
        </html>
    `;
}
