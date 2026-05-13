export async function POST(req) {
  try {
    const body = await req.json();

    console.log("BODY RECEBIDO:", body);

    const {
      id,
      nome,
      telefone,
      telefoneEmpresa,
      itens,
      total,
      subtotal,
      entrega,
      pagamento,
      endereco
    } = body;

    const itensTexto = itens.map(item => {
      const adicionais = item.adicionais?.length
        ? `\n  (${item.adicionais.map(a => a.itemName).join(', ')})`
        : '';

      return `- ${item.qtd}x ${item.nome} (R$${item.preco.toFixed(2)})${adicionais}`;
    }).join('\n');

    const mensagem =
`*Novo Pedido!* 🎉
*ID:* ${id.substring(0,6).toUpperCase()}
*Cliente:* ${nome}
*WhatsApp:* ${telefone}

*Endereço:* ${endereco}

--- *Itens* ---
${itensTexto}

*Subtotal:* R$${subtotal.toFixed(2)}
${entrega > 0 ? `*Entrega:* R$${entrega.toFixed(2)}` : ''}
*Total:* *R$${total.toFixed(2)}*
*Pagamento:* ${pagamento}`;

    const zapiInstance = process.env.ZAPI_INSTANCE;
    const zapiToken = process.env.ZAPI_TOKEN;

    if (zapiInstance && zapiToken) {
      await fetch(`https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: telefoneEmpresa,
          message: mensagem
        })
      }).catch(err => console.error("Erro ao enviar para Z-API:", err));
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (error) {
    console.log("ERRO API:", error);
    return new Response(JSON.stringify({ error: true }), { status: 500 });
  }
}
