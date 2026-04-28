'use client';

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCart, type CartItem } from '@/context/cart-context';
import { ShoppingCart, Minus, Plus, Trash2, CreditCard, DollarSign, Landmark } from 'lucide-react';
import {
  useFirestore,
  addDocument,
  useDoc,
  useMemoFirebase,
  useCollection,
  useUser,
} from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type PaymentMethods = {
  cash: boolean;
  pix: boolean;
  credit: boolean;
  debit: boolean;
  cashAskForChange?: boolean;
};

type CompanyData = {
    paymentMethods?: PaymentMethods;
    phone?: string;
    name?: string;
};

type DeliveryZone = {
  id: string;
  neighborhood: string;
  deliveryFee: number;
  deliveryTime: number;
  isActive: boolean;
};

const CartItemCard = ({ item }: { item: CartItem }) => {
    const { updateQuantity, removeFromCart, updateNotes } = useCart();
    
    return (
        <div className="flex items-start gap-4">
            <div className="flex-grow">
                <p className="font-semibold">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">R$ {item.finalPrice.toFixed(2)}</p>
                {item.selectedVariants && item.selectedVariants.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                        {item.selectedVariants.map(v => `${v.itemName}${v.price > 0 ? ` (+R$${v.price.toFixed(2)})` : ''}`).join(', ')}
                    </div>
                )}
                <Textarea 
                    placeholder='Observações'
                    value={item.notes}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    className="mt-2 text-sm"
                    rows={1}
                />
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                <span className="font-bold">{item.quantity}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    );
};

export default function CartSheet({ companyId }: { companyId: string}) {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return doc(firestore, 'companies', companyId);
  }, [firestore, companyId]);

  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanyData>(companyRef);

  const deliveryZonesRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, `companies/${companyId}/deliveryZones`);
  }, [firestore, companyId]);
  
  const { data: deliveryZones, isLoading: isLoadingZones } = useCollection<DeliveryZone>(deliveryZonesRef);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Retirada'>('Delivery');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [cashAmount, setCashAmount] = useState('');

  // Multi-payment state
  const [isMultiPayment, setIsMultiPayment] = useState(false);
  const [multiPayments, setMultiPayments] = useState<{ method: string, amount: string, cashAmount?: string }[]>([]);

  const selectedZone = useMemo(() => {
    if (deliveryType !== 'Delivery' || !addressNeighborhood) return null;
    return deliveryZones?.find(z => z.neighborhood === addressNeighborhood);
  }, [deliveryType, addressNeighborhood, deliveryZones]);

  const deliveryFee = selectedZone?.deliveryFee || 0;
  const finalTotal = totalPrice + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!firestore || !companyId || !companyData) return;

    if (!customerName.trim()) {
        toast({ variant: 'destructive', title: 'Nome Completo Obrigatório' });
        return;
    }

    if (!customerPhone.trim()) {
        toast({ variant: 'destructive', title: 'WhatsApp Obrigatório' });
        return;
    }

    const rawPhone = customerPhone.replace(/\D/g, '');
    if (rawPhone.length < 10 || rawPhone.length > 11) {
        toast({ variant: 'destructive', title: 'WhatsApp Inválido. Digite o DDD + número válido.' });
        return;
    }

    if (deliveryType === 'Delivery' && (!addressStreet || !addressNumber || !addressNeighborhood)) {
        toast({ variant: 'destructive', title: 'Endereço Incompleto' });
        return;
    }

    if (isMultiPayment) {
        const totalPaid = multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
        if (Math.abs(totalPaid - finalTotal) > 0.01) {
            toast({ variant: 'destructive', title: `O total dos pagamentos (R$ ${totalPaid.toFixed(2)}) deve ser igual ao total do pedido (R$ ${finalTotal.toFixed(2)})` });
            return;
        }
    } else if (!selectedPayment) {
        toast({ variant: 'destructive', title: 'Selecione o pagamento' });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const ordersRef = collection(firestore, 'companies', companyId, 'orders');
    const fullAddress = deliveryType === 'Delivery'
  ? `${addressStreet || 'Rua não informada'}, ${addressNumber || 'S/N'} - ${addressNeighborhood || 'Bairro não informado'} ${addressComplement || ''}`
  : 'Retirada no local';


    const orderData = {
        companyId,
        customerId: user?.uid || 'anonymous',
        customerName: customerName.trim(),
        customerPhone,
        orderDate: serverTimestamp(),
        status: 'Novo',
        deliveryAddress: fullAddress,
        deliveryType,
        deliveryFee,
        paymentMethod: isMultiPayment 
            ? multiPayments.map(p => {
                if (p.method === 'Dinheiro' && p.cashAmount) {
                    return `${p.method}: R$ ${parseFloat(p.amount).toFixed(2)} (Troco p/ R$ ${parseFloat(p.cashAmount).toFixed(2)})`;
                }
                return `${p.method}: R$ ${parseFloat(p.amount).toFixed(2)}`;
            }).join(' | ')
            : (selectedPayment === 'Dinheiro' && cashAmount ? `Dinheiro (Troco para R$ ${parseFloat(cashAmount).toFixed(2)})` : selectedPayment),
        orderItems: cartItems.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            finalPrice: item.finalPrice,
            notes: item.notes || '',
            selectedVariants: item.selectedVariants || [],
        })),
        totalAmount: finalTotal,
    };
    
    
        const docRef = await addDocument(ordersRef, orderData);

        // ── Baixa de estoque via API (server-side) ────────────────────────
        // O cliente anônimo não tem permissão para escrever em /products,
        // por isso chamamos uma API Route que roda com privilégios de admin.
        const stockItems = cartItems
            .filter(item => item.product.stockControlEnabled)
            .map(item => ({ productId: item.product.id, quantity: item.quantity }));

        if (stockItems.length > 0) {
            await fetch('/api/stock/decrement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, items: stockItems }),
            });
        }
        // ─────────────────────────────────────────────────────────────────

        const rawCompanyPhone = companyData.phone?.replace(/\D/g, '') || '';
        const zapNumber = rawCompanyPhone.startsWith('55') ? rawCompanyPhone : (rawCompanyPhone ? `55${rawCompanyPhone}` : '');

        const itensTexto = cartItems.map(item => {
          const adicionais = item.selectedVariants?.length
            ? `\n  (${item.selectedVariants.map(a => a.itemName).join(', ')})`
            : '';
          return `- ${item.quantity}x ${item.product.name} (R$${item.finalPrice.toFixed(2)})${adicionais}`;
        }).join('\n');

        const paymentText = isMultiPayment 
            ? multiPayments.map(p => {
                if (p.method === 'Dinheiro' && p.cashAmount) {
                    return `- ${p.method}: R$ ${parseFloat(p.amount).toFixed(2)} (Troco p/ R$ ${parseFloat(p.cashAmount).toFixed(2)})`;
                }
                return `- ${p.method}: R$ ${parseFloat(p.amount).toFixed(2)}`;
            }).join('\n')
            : (selectedPayment === 'Dinheiro' && cashAmount ? `Dinheiro (Troco para R$ ${parseFloat(cashAmount).toFixed(2)})` : selectedPayment);

        const testMsg = `*Novo Pedido!* 🎉\n*ID:* ${docRef.id.substring(0,6).toUpperCase()}\n*Cliente:* ${customerName.trim()}\n*WhatsApp:* ${customerPhone}\n\n*Endereço:* ${fullAddress}\n\n--- *Itens* ---\n${itensTexto}\n\n*Subtotal:* R$${totalPrice.toFixed(2)}\n${deliveryFee > 0 ? `*Entrega:* R$${deliveryFee.toFixed(2)}\n` : ''}*Total:* *R$${finalTotal.toFixed(2)}*\n\n*Pagamento:* \n${paymentText}`;

        if (zapNumber) {
            const whatsappUrl = `https://wa.me/${zapNumber}?text=${encodeURIComponent(testMsg)}`;
            setWhatsappLink(whatsappUrl);
            
            // Tenta abrir automaticamente
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = whatsappUrl;
            } else {
                window.open(whatsappUrl, '_blank');
            }
        } else {
            // Caso a loja não tenha um número configurado
            console.warn("Loja sem número de WhatsApp configurado.");
        }

        setIsOrderFinished(true);
        clearCart();
        setIsCheckoutOpen(false);
        setIsMultiPayment(false);
        setMultiPayments([]);
        setCustomerName('');
        setCustomerPhone('');
        setSelectedPayment('');
        setCashAmount('');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao enviar pedido' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const enabledPaymentMethods = useMemo(() => {
    if (!companyData?.paymentMethods) return [];
    const methods = [];
    if (companyData.paymentMethods.cash) methods.push({ id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign });
    if (companyData.paymentMethods.pix) methods.push({ id: 'PIX', label: 'PIX', icon: Landmark });
    if (companyData.paymentMethods.credit) methods.push({ id: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: CreditCard });
    if (companyData.paymentMethods.debit) methods.push({ id: 'Cartão de Débito', label: 'Cartão de Débito', icon: CreditCard });
    return methods;
  }, [companyData]);

  const activeDeliveryZones = useMemo(() => {
    return deliveryZones?.filter(zone => zone.isActive) ?? [];
  }, [deliveryZones]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não for número
    if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos
    
    // Formata para (XX) XXXXX-XXXX
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setCustomerPhone(value);
  };

  return (
    <>
      <Sheet onOpenChange={(open) => !open && setIsCheckoutOpen(false)}>
        <SheetTrigger asChild>
          <Button className="fixed bottom-6 right-6 z-20 h-16 w-16 rounded-full shadow-lg">
            <ShoppingCart className="h-8 w-8" />
            {totalItems > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full">{totalItems}</Badge>}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col">
          {isCheckoutOpen ? (
            <>
              <SheetHeader><SheetTitle>Finalizar Pedido</SheetTitle></SheetHeader>
              <ScrollArea className="flex-grow pr-4">
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome Completo <span className="text-destructive">*</span></Label>
                    <Input placeholder="Digite seu nome completo" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>WhatsApp <span className="text-destructive">*</span></Label>
                    <Input placeholder="(99) 99999-9999" value={customerPhone} onChange={handlePhoneChange} maxLength={15} />
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button variant={deliveryType === 'Delivery' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Delivery')}>Delivery</Button>
                    <Button variant={deliveryType === 'Retirada' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Retirada')}>Retirada</Button>
                  </div>
                  {deliveryType === 'Delivery' && (
                    <div className="space-y-3 mt-2">
                      <Input placeholder="Rua" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} />
                      <Input placeholder="Número" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} />
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Selecione o Bairro</Label>
                        <Select value={addressNeighborhood} onValueChange={setAddressNeighborhood}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um bairro" />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingZones ? (
                              <SelectItem value="loading" disabled>Carregando...</SelectItem>
                            ) : activeDeliveryZones.length > 0 ? (
                              activeDeliveryZones.map(zone => (
                                <SelectItem key={zone.id} value={zone.neighborhood}>{zone.neighborhood} (R$ {zone.deliveryFee.toFixed(2)})</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>Nenhum bairro cadastrado</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Pagamento</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-7 px-2 border" 
                      onClick={() => {
                        setIsMultiPayment(!isMultiPayment);
                        if (!isMultiPayment && selectedPayment) {
                          setMultiPayments([{ method: selectedPayment, amount: finalTotal.toFixed(2) }]);
                        } else if (isMultiPayment) {
                          setMultiPayments([]);
                        }
                      }}
                    >
                      {isMultiPayment ? 'Voltar para Único' : 'Dividir Pagamento'}
                    </Button>
                  </div>

                  {!isMultiPayment ? (
                    <>
                      <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                        {enabledPaymentMethods.map(m => (
                          <div key={m.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={m.id} id={m.id} />
                            <Label htmlFor={m.id}>{m.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {selectedPayment === 'Dinheiro' && (
                        <div className="grid gap-2 pl-6 pt-2">
                          <Label className="text-xs">Precisa de troco? Troco para quanto? (opcional)</Label>
                          <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Ex: 50.00 (deixe vazio se não precisar)" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        {enabledPaymentMethods.map(m => {
                          const isSelected = multiPayments.some(p => p.method === m.id);
                          return (
                            <Button 
                              key={m.id}
                              variant={isSelected ? 'default' : 'outline'}
                              className="h-10 text-xs gap-2"
                              onClick={() => {
                                if (isSelected) {
                                  setMultiPayments(multiPayments.filter(p => p.method !== m.id));
                                } else {
                                  const currentSum = multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
                                  const remaining = Math.max(0, finalTotal - currentSum);
                                  setMultiPayments([...multiPayments, { method: m.id, amount: remaining > 0 ? remaining.toFixed(2) : "" }]);
                                }
                              }}
                            >
                              <m.icon className="h-4 w-4" />
                              {m.label}
                            </Button>
                          );
                        })}
                      </div>

                      {multiPayments.length > 0 && (
                        <div className="space-y-3 pt-2">
                          {multiPayments.map((p, idx) => (
                            <div key={p.method} className="space-y-2 p-3 border rounded-lg bg-muted/20">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold">{p.method}</Label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground font-bold">R$</span>
                                  <Input 
                                    type="text" 
                                    className="w-24 h-8" 
                                    value={p.amount} 
                                    onChange={(e) => {
                                      const newPayments = [...multiPayments];
                                      newPayments[idx].amount = e.target.value;
                                      setMultiPayments(newPayments);
                                    }}
                                  />
                                </div>
                              </div>
                              {p.method === 'Dinheiro' && (
                                <div className="grid gap-1.5 pl-2 border-l-2 border-primary/20">
                                  <Label className="text-[10px]">Troco para quanto?</Label>
                                  <Input 
                                    type="number" 
                                    className="h-7 text-xs" 
                                    placeholder="50.00" 
                                    value={p.cashAmount || ''}
                                    onChange={(e) => {
                                      const newPayments = [...multiPayments];
                                      newPayments[idx].cashAmount = e.target.value;
                                      setMultiPayments(newPayments);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                          <div className="flex justify-between items-center text-xs font-bold pt-2 border-t">
                            <span>Total Pago: R$ {multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0).toFixed(2)}</span>
                            <span className={Math.abs(multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) - finalTotal) < 0.01 ? "text-green-600" : "text-destructive"}>
                              {multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) < finalTotal 
                                ? `Falta: R$ ${(finalTotal - multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0)).toFixed(2)}`
                                : multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) > finalTotal 
                                  ? `Excesso: R$ ${(multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) - finalTotal).toFixed(2)}`
                                  : '✓ Valor Completo'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
              <SheetFooter className="pt-4 border-t flex flex-col gap-2">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Itens</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                  {deliveryFee > 0 && <div className="flex justify-between"><span>Entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span>R$ {finalTotal.toFixed(2)}</span></div>
                </div>
                <Button className="w-full h-12 text-lg" onClick={handlePlaceOrder} disabled={isSubmitting}>
                  {isSubmitting ? 'Processando...' : 'Enviar Pedido'}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <>
              <SheetHeader><SheetTitle>Seu Carrinho</SheetTitle></SheetHeader>
              <ScrollArea className="flex-grow">
                <div className="space-y-4 py-4">
                  {cartItems.map(item => <CartItemCard key={item.id} item={item} />)}
                </div>
              </ScrollArea>
              <SheetFooter className="pt-4 border-t flex flex-col gap-2">
                <div className="flex justify-between font-bold text-lg"><span>Subtotal</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                <Button className="w-full h-12 text-lg" onClick={() => setIsCheckoutOpen(true)} disabled={cartItems.length === 0}>Finalizar Pedido</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={isOrderFinished} onOpenChange={setIsOrderFinished}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pedido Salvo! 🎉</AlertDialogTitle>
            <AlertDialogDescription>Seu pedido já está no sistema, mas falta um último passo! Envie a mensagem para o restaurante clicando no botão abaixo para confirmar seu pedido.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white">
                  Enviar Confirmação no WhatsApp
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setIsOrderFinished(false)}>
              Fechar Relatório
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
