'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { MessageCircle, Send, X } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

type Message = { role: 'assistant' | 'customer'; text: string };
type Company = { name?: string; phone?: string; paymentMethods?: Record<string, boolean> };
type Zone = { neighborhood: string; deliveryFee: number; isActive?: boolean };
const welcome = 'Olá! Posso ajudar você a terminar seu pedido. O que está dificultando: entrega, pagamento ou como finalizar?';
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrderHelp({ companyId }: { companyId: string }) {
  const { cartItems, totalPrice } = useCart();
  const firestore = useFirestore();
  const companyRef = useMemoFirebase(() => firestore ? doc(firestore, 'companies', companyId) : null, [firestore, companyId]);
  const zonesRef = useMemoFirebase(() => firestore ? collection(firestore, 'companies', companyId, 'deliveryZones') : null, [firestore, companyId]);
  const { data: company } = useDoc<Company>(companyRef);
  const { data: zones } = useCollection<Zone>(zonesRef);
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: welcome }]);
  const offered = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const cartKey = JSON.stringify(cartItems);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('deliveryhub:order-help-offer', { detail: offer }));
    return () => { window.dispatchEvent(new CustomEvent('deliveryhub:order-help-offer', { detail: false })); };
  }, [offer]);

  useEffect(() => {
    if (!cartItems.length) { setOffer(false); return; }
    if (open || offered.current) return;
    // Restart the timer on activity; suggest help once per visit.
    let timer: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) { restart(); return; }
        offered.current = true;
        setOffer(true);
      }, 10000);
    };
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach(event => window.addEventListener(event, restart, { passive: true }));
    restart();
    return () => { clearTimeout(timer); events.forEach(event => window.removeEventListener(event, restart)); };
  }, [cartKey, open, cartItems.length]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, open]);

  const answer = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let reply: string;
    if (/entrega|bairro|frete|endereco|taxa/.test(normalized)) {
      const active = zones?.filter(zone => zone.isActive) || [];
      reply = active.length
        ? `Alguns bairros atendidos: ${active.slice(0, 8).map(zone => `${zone.neighborhood} (${money(zone.deliveryFee)})`).join(', ')}. No carrinho, selecione seu bairro para conferir a taxa atual e o total antes de confirmar.`
        : 'Abra o carrinho e selecione seu bairro para conferir se a loja atende seu endereço e qual é a taxa. Se o bairro não aparecer, consulte a loja antes de pedir.';
    } else if (/pagamento|pagar|pix|cartao|dinheiro/.test(normalized)) {
      const methods = company?.paymentMethods;
      const labels: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', credit: 'Cartão de crédito', debit: 'Cartão de débito' };
      const enabled = methods ? Object.entries(labels).filter(([key]) => methods[key]).map(([, label]) => label) : [];
      reply = enabled.length ? `As formas de pagamento habilitadas são: ${enabled.join(', ')}. Você escolhe no carrinho. Se pagar em dinheiro, informe se precisa de troco.` : 'Você pode conferir as formas de pagamento disponíveis no carrinho, antes de confirmar o pedido.';
    } else if (/caro|preco|valor|desconto|cupom/.test(normalized)) {
      reply = `Os produtos no seu carrinho somam ${money(totalPrice)}, antes de entrega e descontos. Você pode remover produtos ou diminuir as quantidades no carrinho. Se tiver um cupom da loja, informe no campo de cupom para verificar se é válido.`;
    } else if (/login|senha|cadastro|conta/.test(normalized)) {
      reply = 'Atualmente, para pedir por delivery, é necessário entrar ou se cadastrar. Use o botão de acesso no topo do cardápio. Se estiver com dificuldade, posso mostrar como finalizar ou você pode falar com a loja.';
    } else if (/finalizar|concluir|terminar|comprar|pedido/.test(normalized)) {
      reply = cartItems.length ? 'Toque em “Continuar meu pedido” abaixo. Confira os produtos, toque em “Finalizar Pedido”, preencha seus dados e escolha o pagamento. Revise o total e confirme o envio. O pedido só será enviado quando você confirmar.' : 'Primeiro escolha um produto no cardápio e adicione ao pedido. Depois abra o carrinho para conferir os itens e finalizar.';
    } else {
      reply = 'Entendi. Esta versão de teste tem respostas guiadas sobre entrega, pagamento, valores e finalização. Escolha uma opção abaixo ou fale diretamente com a loja para uma dúvida específica.';
    }
    setMessages(previous => [...previous, { role: 'customer', text }, { role: 'assistant', text: reply }]);
    setInput('');
  };

  const start = () => { offered.current = true; setOffer(false); setOpen(true); };
  const phone = company?.phone?.replace(/\D/g, '');
  return <>
    <div className="fixed bottom-28 right-6 z-20 flex max-w-[calc(100vw-3rem)] flex-col items-end">
      {offer && <div className="mb-3 w-72 rounded-2xl border bg-background p-4 shadow-xl">
        <button className="float-right p-1" aria-label="Dispensar ajuda" onClick={() => setOffer(false)}><X size={20} /></button>
        <p className="pr-6 text-lg font-semibold">Precisa de ajuda para pedir?</p>
        <p className="my-2 text-base text-muted-foreground">Posso ajudar com entrega, pagamento e finalização.</p>
        <Button className="h-12 w-full text-base" onClick={start}>Quero ajuda</Button>
      </div>}
      <Button className="h-12 rounded-full px-4 text-base shadow-lg" onClick={start}><MessageCircle className="mr-2 h-5 w-5" />Ajuda para pedir</Button>
    </div>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left"><SheetTitle className="text-xl">Ajuda para pedir</SheetTitle><SheetDescription>Demonstração com respostas guiadas • {company?.name || 'Cardápio'}</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4" role="log" aria-live="polite" aria-label="Conversa de ajuda">
          {messages.map((message, index) => <div key={index} className={`rounded-2xl p-4 text-lg leading-relaxed ${message.role === 'customer' ? 'ml-6 bg-primary text-primary-foreground' : 'mr-6 bg-muted'}`}><span className="mb-1 block text-xs font-semibold">{message.role === 'customer' ? 'Você' : 'Assistente'}</span>{message.text}</div>)}
          <div ref={bottom} />
        </div>
        <div className="grid grid-cols-2 gap-2">{['Como finalizar?', 'Entrega e taxa', 'Formas de pagamento', 'Achei caro'].map(option => <Button key={option} variant="outline" className="h-auto min-h-12 whitespace-normal text-base" onClick={() => answer(option)}>{option}</Button>)}</div>
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); answer(input); }}><Input aria-label="Sua dúvida" placeholder="Escreva sua dúvida" className="h-12 text-base" maxLength={500} value={input} onChange={event => setInput(event.target.value)} /><Button type="submit" className="h-12 w-12 shrink-0" aria-label="Enviar dúvida" disabled={!input.trim()}><Send size={20} /></Button></form>
        <Button className="min-h-12 text-lg" disabled={!cartItems.length} onClick={() => { setOpen(false); window.dispatchEvent(new Event('deliveryhub:open-cart')); }}>Continuar meu pedido</Button>
        <Button variant="outline" className="min-h-12 text-base" onClick={() => { setOpen(false); window.dispatchEvent(new Event('deliveryhub:register')); }}>Quero ajuda para me cadastrar</Button>
        {phone && <a className="py-2 text-center text-base underline" href={`https://wa.me/${phone.startsWith('55') ? phone : `55${phone}`}`} target="_blank" rel="noopener noreferrer">Falar com a loja pelo WhatsApp</a>}
      </SheetContent>
    </Sheet>
  </>;
}
