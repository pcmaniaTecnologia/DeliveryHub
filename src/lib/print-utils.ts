import type { Order } from '../../app/dashboard/orders/page';

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
            return `<br><span style="color: #000; padding-left: 10px; font-size: 0.9em; font-weight: bold;"><strong>${group}:</strong> ${itemsText}</span>`;
        }).join('');
        
        const priceToUse = item.finalPrice || item.unitPrice;

        return `
            <tr>
                <td colspan="3" style="padding-top: 5px;">
                    <strong style="font-size: 1.1em; color: #000;">${item.isSoldByWeight ? `${item.quantity.toFixed(3).replace('.', ',')} kg` : `${item.quantity}x`} ${item.productName || item.productId}</strong>
                    ${variantsText}
                    ${item.notes ? `<br><span style="color: #000; padding-left: 10px; font-size: 0.9em; font-weight: bold; font-style: normal;">OBS: ${item.notes}</span>` : ''}
                </td>
            </tr>
            <tr>
                <td style="padding-bottom: 5px; color: #000; font-weight: bold;">&nbsp;</td>
                <td style="text-align: center; padding-bottom: 5px; color: #000; font-weight: bold; font-size: 0.9em;">R$${priceToUse.toFixed(2)}</td>
                <td style="text-align: right; padding-bottom: 5px; color: #000; font-weight: bold; font-size: 0.9em;">R$${(priceToUse * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const subtotal = order.subtotal || (order.totalAmount - (order.deliveryFee || 0) + (order.discount || 0));

    return `
        <html>
            <head>
                <title>Pedido ${order.id.substring(0,6).toUpperCase()}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12pt; margin: 20px; color: #000; font-weight: bold; }
                    h2, p { margin: 0; text-align: center; color: #000; }
                    h2 { font-size: 1.4em; font-weight: 900; }
                    hr { border: none; border-top: 2px dashed black; margin: 10px 0; }
                    table { width: 100%; border-collapse: collapse; color: #000; }
                    th, td { padding: 4px 0; }
                    th { text-align: left; border-bottom: 2px dashed black; font-weight: 900; font-size: 1.1em; }
                    td { font-weight: bold; }
                    .totals { text-align: right; margin-top: 10px; color: #000; }
                    .totals strong { font-size: 1.3em; font-weight: 900; }
                    .section { margin-top: 15px; color: #000; font-weight: bold; }
                    .section p { text-align: left; margin-bottom: 4px; }
                    .section-title { font-weight: 900; font-size: 1.1em; text-transform: uppercase; }
                </style>
            </head>
            <body>
                <h2>${company?.name || 'Seu Restaurante'}</h2>
                <p>Pedido: ${order.id.substring(0, 6).toUpperCase()}</p>
                <p>${order.orderDate?.toDate ? order.orderDate.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</p>
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
                    ${order.discount && order.discount > 0 ? `<p>Desconto: - R$${order.discount.toFixed(2)}</p>` : ''}
                    ${order.deliveryFee && order.deliveryFee > 0 ? `<p>Taxa de Entrega: R$${order.deliveryFee.toFixed(2)}</p>` : ''}
                    <strong>Total: R$${order.totalAmount.toFixed(2)}</strong>
                </div>
                 <hr />
                <p style="text-align: left;">Pagamento: ${order.paymentMethod}</p>
                ${order.amountReceived && order.amountReceived > 0 ? `<p style="text-align: left;">Recebido: R$${order.amountReceived.toFixed(2)}</p>` : ''}
                ${order.change && order.change > 0 ? `<p style="text-align: left;">Troco: R$${order.change.toFixed(2)}</p>` : ''}
                <p style="text-align: left;">Entrega: ${order.deliveryType}</p>
                <div style="text-align: center; margin-top: 20px; font-weight: bold; font-size: 1.1em;">sistema criado por PC MANIA<br>www.pcmania.net</div>
                <script>
                    window.print();
                    window.onafterprint = () => window.close();
                </script>
            </body>
        </html>
    `;
}

export function generateTokenPrintHtml(quantity: number, productName: string, price: number, companyName?: string, paymentMethod?: string) {
    let html = `
        <html>
            <head>
                <title>Fichas</title>
                <style>
                    @media print {
                        @page { margin: 0; }
                        body { margin: 0; padding: 0; }
                    }
                    body { font-family: 'Courier New', monospace; margin: 0; padding: 0; color: #000; font-weight: bold; }
                    .ficha { 
                        width: 100%; 
                        padding: 20px 10px; 
                        border-bottom: 2px dashed black; 
                        text-align: center;
                        page-break-inside: avoid;
                        box-sizing: border-box;
                    }
                    h2 { font-size: 1.4em; font-weight: 900; margin: 0 0 10px 0; }
                    .produto { font-size: 1.8em; font-weight: 900; margin: 10px 0; text-transform: uppercase; }
                    .data { font-size: 0.9em; margin: 5px 0; }
                    .info { font-size: 1em; margin: 5px 0; }
                    .ficha-num { font-size: 0.85em; margin: 6px 0; font-weight: bold; }
                    .valido { margin-top: 15px; font-size: 1.2em; font-weight: bold; border: 2px solid black; padding: 5px; display: inline-block; }
                </style>
            </head>
            <body>
    `;

    const dateStr = new Date().toLocaleString('pt-BR');

    for(let i = 0; i < quantity; i++) {
        html += `
            <div class="ficha">
                <h2>${companyName || 'Restaurante'}</h2>
                <div class="produto">1x ${productName}</div>
                <div class="data">${dateStr}</div>
                <div class="info">Valor: R$ ${price.toFixed(2)}</div>
                ${paymentMethod ? `<div class="info">Pagamento: ${paymentMethod}</div>` : ''}
                ${quantity > 1 ? `<div class="ficha-num">Ficha ${i + 1} de ${quantity}</div>` : ''}
                <div class="valido">VÁLIDO PARA 1 CONSUMO</div>
            </div>
        `;
    }

    html += `
                <script>
                    window.print();
                    window.onafterprint = () => window.close();
                </script>
            </body>
        </html>
    `;
    return html;
}

export function generateOrderTokensPrintHtml(order: Order, company?: Company) {
    let html = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8" />
                <title>Fichas - Pedido ${order.id.substring(0, 6).toUpperCase()}</title>
                <style>
                    @media print {
                        @page { margin: 0; }
                        body { margin: 0; padding: 0; }
                    }
                    body { font-family: 'Courier New', monospace; margin: 0; padding: 0; color: #000; font-weight: bold; }
                    .ficha { 
                        width: 100%; 
                        padding: 20px 10px; 
                        border-bottom: 2px dashed black; 
                        text-align: center;
                        page-break-inside: avoid;
                        box-sizing: border-box;
                    }
                    h2 { font-size: 1.4em; font-weight: 900; margin: 0 0 10px 0; }
                    .produto { font-size: 1.8em; font-weight: 900; margin: 10px 0; text-transform: uppercase; }
                    .data { font-size: 0.9em; margin: 5px 0; }
                    .info { font-size: 1em; margin: 5px 0; }
                    .variants { font-size: 0.85em; margin: 5px 0; }
                    .obs { font-size: 0.85em; font-style: italic; margin: 5px 0; }
                    .ficha-num { font-size: 0.85em; margin: 6px 0; font-weight: bold; }
                    .valido { margin-top: 15px; font-size: 1.2em; font-weight: bold; border: 2px solid black; padding: 5px; display: inline-block; }
                </style>
            </head>
            <body>
    `;

    let dateStr = new Date().toLocaleString('pt-BR');
    if (order.orderDate) {
        if (typeof (order.orderDate as any).toDate === 'function') {
            dateStr = (order.orderDate as any).toDate().toLocaleString('pt-BR');
        } else if (order.orderDate instanceof Date) {
            dateStr = order.orderDate.toLocaleString('pt-BR');
        } else if ((order.orderDate as any).seconds) {
            dateStr = new Date((order.orderDate as any).seconds * 1000).toLocaleString('pt-BR');
        }
    }

    const totalTokens = (order.orderItems || []).reduce((sum, item) => {
        return sum + (item.isSoldByWeight ? 1 : Math.max(1, Math.round(item.quantity || 1)));
    }, 0);

    let currentTokenIndex = 0;

    (order.orderItems || []).forEach(item => {
        const qty = item.isSoldByWeight ? 1 : Math.max(1, Math.round(item.quantity || 1));
        const price = item.finalPrice || item.unitPrice || 0;

        const groupedVariants: { [key: string]: { name: string; price: number }[] } = {};
        if (item.selectedVariants) {
            item.selectedVariants.forEach(v => {
                if (!groupedVariants[v.groupName]) groupedVariants[v.groupName] = [];
                groupedVariants[v.groupName].push({ name: v.itemName, price: v.price });
            });
        }
        const variantsText = Object.entries(groupedVariants).map(([group, items]) => {
            const itemsText = items.map(i => `${i.name}${i.price > 0 ? ` (+R$${i.price.toFixed(2)})` : ''}`).join(', ');
            return `<div>${group}: ${itemsText}</div>`;
        }).join('');

        for (let i = 0; i < qty; i++) {
            currentTokenIndex++;
            html += `
                <div class="ficha">
                    <h2>${company?.name || 'Restaurante'}</h2>
                    <div class="produto">${item.isSoldByWeight ? `${item.quantity.toFixed(3).replace('.', ',')} kg ` : '1x '}${item.productName || item.productId}</div>
                    ${variantsText ? `<div class="variants">${variantsText}</div>` : ''}
                    ${item.notes ? `<div class="obs">OBS: ${item.notes}</div>` : ''}
                    <div class="data">${dateStr}</div>
                    <div class="info">Valor: R$ ${price.toFixed(2)}</div>
                    ${order.paymentMethod ? `<div class="info">Pagamento: ${order.paymentMethod}</div>` : ''}
                    ${order.customerName && order.notes !== 'Venda de Ficha Rápida' && !order.customerName.toLowerCase().includes('ficha') ? `<div class="info">Cliente: ${order.customerName}</div>` : ''}
                    <div class="ficha-num">Pedido #${order.id.substring(0, 6).toUpperCase()}${totalTokens > 1 ? ` &bull; Ficha ${currentTokenIndex} de ${totalTokens}` : ''}</div>
                    <div class="valido">VÁLIDO PARA 1 CONSUMO</div>
                </div>
            `;
        }
    });

    html += `
                <script>
                    window.print();
                    window.onafterprint = () => window.close();
                </script>
            </body>
        </html>
    `;
    return html;
}

/**
 * Imprime o HTML gerado de forma limpa e não-bloqueante usando um iframe invisível.
 * Evita o congelamento do JavaScript no navegador (window.print bloqueante)
 * e previne que popups sejam bloqueados ou travem o Radix UI.
 */
export function printHtml(html: string) {
    if (typeof window === 'undefined') return;

    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!iframeDoc) {
            throw new Error('Não foi possível acessar o documento do iframe');
        }

        iframeDoc.open();
        iframeDoc.write(cleanHtml);
        iframeDoc.close();

        const triggerPrint = () => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (e) {
                console.error('Erro ao chamar print() no iframe:', e);
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    if (typeof document !== 'undefined') {
                        document.body.style.pointerEvents = 'auto';
                    }
                }, 1000);
            }
        };

        setTimeout(triggerPrint, 300);
    } catch (err) {
        console.warn('Fallback para window.open devido a erro no iframe:', err);
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        }
        if (typeof document !== 'undefined') {
            document.body.style.pointerEvents = 'auto';
        }
    }
}


