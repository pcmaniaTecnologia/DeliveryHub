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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isStoreOpen } from '@/lib/utils';


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
    businessHours?: string;
    closedMessage?: string;
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
                <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">R$ {item.finalPrice.toFixed(2)}</p>
                </div>
                {item.selectedVariants && item.selectedVariants.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1 bg-muted/50 p-1 rounded">
                        {item.selectedVariants.map(v => `${v.itemName}${v.price > 0 ? ` (+R$${v.price.toFixed(2)})` : ''}`).join(', ')}
                    </div>
                )}
                <Textarea 
                    placeholder='Observações (Ex: Sem cebola)'
                    value={item.notes}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    className="mt-2 text-xs min-h-[40px]"
                    rows={1}
                />
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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

  const selectedZone = useMemo(() => {
    if (deliveryType !== 'Delivery' || !addressNeighborhood) return null;
    return deliveryZones?.find(z => z.neighborhood === addressNeighborhood);
  }, [deliveryType, addressNeighborhood, deliveryZones]);

  const deliveryFee = selectedZone?.deliveryFee || 0;
  const finalTotal = totalPrice + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!firestore || !companyId || !companyData) return;

    const status = isStoreOpen(companyData.businessHours);
    if (!status.isOpen) {
        toast({
            variant: 'destructive',
            title: 'Loja Fechada',
            description: companyData.closedMessage || 'Desculpe, não estamos aceitando pedidos no momento.',
        });
        return;
    }

    if (!customerName.trim()) {
        toast({ variant: 'destructive', title: 'Nome Completo Obrigatório' });
        return;
    }

    if (!customerPhone.trim()) {
        toast({ variant: 'destructive', title: 'WhatsApp Obrigatório' });
        return;
    }

    if (!selectedPayment) {
      toast({ variant: 'destructive', title: 'Selecione a forma de pagamento' });
      return;
    }

    if (deliveryType === 'Delivery' && (!addressStreet || !addressNumber || !addressNeighborhood)) {
        toast({ variant: 'destructive', title: 'Endereço Incompleto', description: 'Por favor, preencha rua, número e bairro.' });
        return;
    }
    
    const ordersRef = collection(firestore, 'companies', companyId, 'orders');
    const fullAddress = deliveryType === 'Delivery'
      ? `${addressStreet}, ${addressNumber} - ${addressNeighborhood}${addressComplement ? ` (${addressComplement})` : ''}`
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
        paymentMethod: selectedPayment === 'Dinheiro' && cashAmount ? `Dinheiro (Troco para R$${parseFloat(cashAmount).toFixed(2)})` : selectedPayment,
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
    
    try {
        const docRef = await addDocument(ordersRef, orderData);
        
        if (companyData.phone) {
            const itemsSummary = cartItems.map(item => {
                const variantsSummary = item.selectedVariants && item.selectedVariants.length > 0 
                    ? `\n  (${item.selectedVariants.map(v => `${v.itemName}${v.price > 0 ? ` +R$${v.price.toFixed(2)}` : ''}`).join(', ')})` 
                    : '';
                return `- ${item.quantity}x ${item.product.name} (R$${item.finalPrice.toFixed(2)})${variantsSummary}`;
            }).join('\n');

            const message = `*Novo Pedido!* 🎉\n` +
                            `*ID:* ${docRef.id.substring(0, 6).toUpperCase()}\n` +
                            `*Cliente:* ${customerName}\n\n` +
                            `--- *Itens* ---\n${itemsSummary}\n\n` +
                            `*Subtotal:* R$${totalPrice.toFixed(2)}\n` +
                            `${deliveryFee > 0 ? `*Entrega:* R$${deliveryFee.toFixed(2)}\n` : ''}` +
                            `*Total:* *R$${finalTotal.toFixed(2)}*\n` +
                            `*Pagamento:* ${orderData.paymentMethod}`;

            const whatsappUrl = `https://wa.me/55${companyData.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, 'whatsapp_window');
        }

        setIsOrderFinished(true);
        clearCart();
        setIsCheckoutOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao enviar pedido' });
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

  return (
    <>
      <Sheet onOpenChange={(open) => !open && setIsCheckoutOpen(false)}>
        <SheetTrigger asChild>
          <Button className="fixed bottom-6 right-6 z-20 h-16 w-16 rounded-full shadow-lg">
            <ShoppingCart className="h-8 w-8" />
            {totalItems > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full">{totalItems}</Badge>}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col sm:max-w-md w-full">
            {isCheckoutOpen ? (
                <>
                    <SheetHeader><SheetTitle>Finalizar Pedido</SheetTitle></SheetHeader>
                    <ScrollArea className="flex-grow pr-4">
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nome Completo <span className="text-destructive">*</span></Label>
                                <Input placeholder="Seu nome" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>WhatsApp <span className="text-destructive">*</span></Label>
                                <Input placeholder="(00) 00000-0000" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                            </div>
                            <Separator />
                            <div className="flex gap-2">
                                <Button variant={deliveryType === 'Delivery' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Delivery')}>Delivery</Button>
                                <Button variant={deliveryType === 'Retirada' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Retirada')}>Retirada</Button>
                            </div>
                            {deliveryType === 'Delivery' && (
                                <div className="space-y-3 mt-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                            <Input placeholder="Rua" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} />
                                        </div>
                                        <Input placeholder="Nº" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Selecione o Bairro <span className="text-destructive">*</span></Label>
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
                                    <Input placeholder="Complemento (Opcional)" value={addressComplement} onChange={e => setAddressComplement(e.target.value)} />
                                </div>
                            )}
                            <Separator />
                            <h3 className="font-semibold">Pagamento <span className="text-destructive">*</span></h3>
                            <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                                {enabledPaymentMethods.map(m => (
                                    <div key={m.id} className="flex items-center space-x-2">
                                        <RadioGroupItem value={m.id} id={m.id} /><Label htmlFor={m.id}>{m.label}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                            {selectedPayment === 'Dinheiro' && companyData?.paymentMethods?.cashAskForChange && (
                                <div className="grid gap-2 pl-6 pt-2">
                                    <Label className="text-xs">Troco para quanto?</Label>
                                    <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Ex: 50.00" />
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <SheetFooter className="pt-4 border-t flex flex-col gap-2">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-muted-foreground"><span>Itens</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                            {deliveryFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>}
                            <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span className="text-primary">R$ {finalTotal.toFixed(2)}</span></div>
                        </div>
                        <Button className="w-full h-12 text-lg shadow-md" onClick={handlePlaceOrder}>Confirmar e Enviar</Button>
                    </SheetFooter>
                </>
            ) : (
                <>
                    <SheetHeader><SheetTitle>Seu Carrinho</SheetTitle></SheetHeader>
                    <ScrollArea className="flex-grow"><div className="space-y-4 py-4">{cartItems.length > 0 ? cartItems.map(item => <CartItemCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground py-8">Seu carrinho está vazio.</p>}</div></ScrollArea>
                    <SheetFooter className="pt-4 border-t flex flex-col gap-2">
                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                        <Button className="w-full h-12 text-lg" onClick={() => setIsCheckoutOpen(true)} disabled={cartItems.length === 0}>Finalizar Pedido</Button>
                    </SheetFooter>
                </>
            )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={isOrderFinished} onOpenChange={setIsOrderFinished}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Pedido Enviado!</AlertDialogTitle><AlertDialogDescription>Seu pedido foi recebido com sucesso. Você pode acompanhar o status pelo WhatsApp.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogAction onClick={() => setIsOrderFinished(false)}>Entendi</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
