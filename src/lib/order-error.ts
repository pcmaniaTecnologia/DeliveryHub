export function getOrderErrorMessage(error: unknown): string {
  const details = error as { code?: string; message?: string } | null;
  const code = details?.code?.replace(/^firestore\//, '');
  if (code === 'resource-exhausted' || /quota exceeded|quota limit exceeded/i.test(details?.message || '')) {
    return 'O sistema da loja atingiu um limite de uso e não conseguiu confirmar seu pedido. Seu carrinho foi mantido. Fale com a loja ou tente novamente mais tarde.';
  }
  if (code === 'permission-denied') {
    return 'O servidor não autorizou o envio. Entre em contato com a loja.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Não foi possível confirmar o envio agora. Confira sua conexão e tente novamente. A nova tentativa reutiliza a identificação deste pedido.';
  }
  return 'Não foi possível confirmar seu pedido. Seu carrinho foi mantido. Tente novamente ou entre em contato com a loja.';
}
