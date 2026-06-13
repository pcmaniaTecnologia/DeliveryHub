'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ShoppingCart, Minus, Plus, Trash2, CreditCard, DollarSign, Landmark, MapPin, User } from 'lucide-react';
import {
  useFirestore,
  addDocument,
  useDoc,
  useMemoFirebase,
  useCollection,
  useUser,
} from '@/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
import { CustomerAuthDialog } from '@/components/menu/customer-auth-dialog';


type PaymentMethods = {
  cash: boolean;
  pix: boolean;
  credit: boolean;
  debit: boolean;
  cashAskForChange?: boolean;
};

type CompanyData = {
    paymentMethods?: PaymentMethods;
    pixKey?: string;
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
                    <span className="font-bold text-sm min-w-4 text-center">{item.product.isSoldByWeight ? `${item.quantity.toFixed(3).replace('.', ',')}kg` : item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
        </div>
    );
};

export default function CartSheet({ companyId, tableNumber }: { companyId: string; tableNumber?: string | null }) {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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
  
  const productsRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return collection(firestore, `companies/${companyId}/products`);
  }, [firestore, companyId]);
  
  const { data: productsData } = useCollection<any>(productsRef);

  const searchParams = useSearchParams();
  const tableParam = searchParams?.get('table');
  const waiterParam = searchParams?.get('waiter');
  const isAdmin = searchParams?.get('admin') === 'true';

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Retirada' | 'Mesa'>('Delivery');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [cashAmount, setCashAmount] = useState('');

  // Multi-payment state
  const [isMultiPayment, setIsMultiPayment] = useState(false);
  const [multiPayments, setMultiPayments] = useState<{ method: string, amount: string, cashAmount?: string }[]>([]);

  // Effect to handle table orders from URL
  useEffect(() => {
    if (tableParam) {
      setDeliveryType('Mesa');
      // If we're at a table, we might not need customer phone/name immediately, 
      // but the system requires them. Let's set some defaults if they're empty.
      if (!customerName) setCustomerName('Cliente na Mesa');
      if (!customerPhone) setCustomerPhone('(00) 00000-0000');
    }
  }, [tableParam]);

  const selectedZone = useMemo(() => {
    if (deliveryType !== 'Delivery' || !addressNeighborhood) return null;
    return deliveryZones?.find(z => z.neighborhood === addressNeighborhood);
  }, [deliveryType, addressNeighborhood, deliveryZones]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user || user.isAnonymous) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userProfile } = useDoc<any>(userProfileRef);

  useEffect(() => {
    if (userProfile && !customerName) {
      if (userProfile.name) setCustomerName(userProfile.name);
      if (userProfile.phone) setCustomerPhone(userProfile.phone);
      if (userProfile.addressStreet) setAddressStreet(userProfile.addressStreet);
      if (userProfile.addressNumber) setAddressNumber(userProfile.addressNumber);
      if (userProfile.addressNeighborhood) setAddressNeighborhood(userProfile.addressNeighborhood);
      if (userProfile.addressComplement) setAddressComplement(userProfile.addressComplement);
    }
  }, [userProfile]);

  const deliveryFee = selectedZone?.deliveryFee || 0;
  const finalTotal = totalPrice + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!firestore || !companyId) return;

    if (!companyData) {
        toast({ variant: 'destructive', title: 'Aguarde', description: 'Dados da loja ainda estão carregando. Tente novamente.' });
        return;
    }

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

    const rawPhone = customerPhone.replace(/\D/g, '');
    if (deliveryType !== 'Mesa' && (rawPhone.length < 10 || rawPhone.length > 11)) {
        toast({ variant: 'destructive', title: 'WhatsApp Inválido. Digite o DDD + número válido.' });
        return;
    }

    if (deliveryType !== 'Mesa') {
        if (isMultiPayment) {
            const totalPaid = multiPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
            if (Math.abs(totalPaid - finalTotal) > 0.01) {
                toast({ variant: 'destructive', title: `O total dos pagamentos (R$ ${totalPaid.toFixed(2)}) deve ser igual ao total do pedido (R$ ${finalTotal.toFixed(2)})` });
                return;
            }
        } else if (!selectedPayment) {
          toast({ variant: 'destructive', title: 'Selecione a forma de pagamento' });
          return;
        }
    }

    if (deliveryType === 'Delivery' && (!user || user.isAnonymous)) {
        toast({ variant: 'destructive', title: 'Login Obrigatório', description: 'Por favor, faça login ou cadastre-se para pedir por delivery.' });
        return;
    }

    if (deliveryType === 'Delivery') {
        if (!addressStreet || !addressNumber || !addressNeighborhood) {
            toast({ variant: 'destructive', title: 'Endereço Incompleto', description: 'Por favor, preencha rua, número e bairro.' });
            return;
        }
        if (!selectedZone) {
            toast({ variant: 'destructive', title: 'Bairro Inválido', description: 'Por favor, selecione um bairro válido para entrega listado nas opções.' });
            return;
        }
    }

    // Check for out of stock items with blocking enabled (using fresh productsData)
    const blockedItems = cartItems.filter(item => {
        const freshProduct = productsData?.find((p: any) => p.id === item.product.id);
        if (!freshProduct) return false;
        
        return (
            freshProduct.stockControlEnabled && 
            freshProduct.blockIfOutOfStock !== false && 
            (Number(freshProduct.stock) || 0) < item.quantity
        );
    });

    if (blockedItems.length > 0) {
        toast({
            variant: 'destructive',
            title: 'Itens Esgotados no Carrinho',
            description: `Os itens a seguir acabaram ou as vendas foram bloqueadas: ${blockedItems.map(i => i.product.name).join(', ')}. Remova-os para continuar.`
        });
        setIsSubmitting(false);
        return;
    }
    
    setIsSubmitting(true);
    try {
        const ordersRef = collection(firestore, 'companies', companyId, 'orders');
    const fullAddress = deliveryType === 'Delivery'
      ? `${addressStreet}, ${addressNumber} - ${addressNeighborhood}${addressComplement ? ` (${addressComplement})` : ''}`
      : deliveryType === 'Mesa'
        ? `Consumo na Mesa ${tableParam}`
        : 'Retirada no local';

    const orderData = {
        companyId: String(companyId || ''),
        customerId: String(user?.uid || 'anonymous'),
        customerName: String(customerName || 'Cliente').trim(),
        customerPhone: String(customerPhone || ''),
        orderDate: serverTimestamp(),
        status: 'Novo',
        deliveryAddress: String(fullAddress || ''),
        deliveryType: String(deliveryType || 'Delivery'),
        deliveryFee: Number(deliveryFee) || 0,
        tableNumber: tableParam ? String(tableParam) : null,
        waiterName: waiterParam ? String(waiterParam) : (isAdmin ? 'Admin' : null),
        paymentMethod: String(deliveryType === 'Mesa' ? 'A Combinar' : (isMultiPayment 
            ? multiPayments.map(p => {
                if (p.method === 'Dinheiro' && p.cashAmount) {
                    return `${p.method}: R$ ${parseFloat(p.amount || '0').toFixed(2)} (Troco p/ R$ ${parseFloat(p.cashAmount || '0').toFixed(2)})`;
                }
                return `${p.method}: R$ ${parseFloat(p.amount || '0').toFixed(2)}`;
            }).join(' | ')
            : (selectedPayment === 'Dinheiro' && cashAmount ? `Dinheiro (Troco para R$ ${parseFloat(cashAmount || '0').toFixed(2)})` : (selectedPayment || 'A Combinar')))),
        orderItems: cartItems.map(item => ({
            productId: String(item.product.id || ''),
            productName: String(item.product.name || 'Produto'),
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.product.price) || 0,
            finalPrice: Number(item.finalPrice) || 0,
            notes: String(item.notes || '').trim(),
            selectedVariants: (item.selectedVariants || []).map(v => ({
                groupName: String(v.groupName || ''),
                itemName: String(v.itemName || ''),
                price: Number(v.price) || 0
            })),
            isSoldByWeight: Boolean(item.product.isSoldByWeight),
        })),
        totalAmount: Number(finalTotal) || 0,
    };
    
    
        const docRef = await addDocument(ordersRef, orderData);
        
        // Decrementar estoque em background
        const stockItems = cartItems
            .filter(item => item.product.stockControlEnabled)
            .map(item => ({ productId: item.product.id, quantity: item.quantity }));

        if (stockItems.length > 0) {
            fetch('/api/stock/decrement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId, items: stockItems }),
            }).catch(err => console.error("Erro ao baixar estoque:", err));
        }

        // Atualiza perfil do usuário se estiver logado
        if (user && !user.isAnonymous) {
            setDoc(doc(firestore, 'users', user.uid), {
                name: customerName,
                phone: customerPhone,
                addressStreet: addressStreet,
                addressNumber: addressNumber,
                addressNeighborhood: addressNeighborhood,
                addressComplement: addressComplement,
                updatedAt: serverTimestamp()
            }, { merge: true }).catch(err => console.error("Erro ao salvar perfil:", err));
        }
        
        if (companyData.phone) {
            const itemsSummary = cartItems.map(item => {
                const variantsSummary = item.selectedVariants && item.selectedVariants.length > 0 
                    ? `\n  (${item.selectedVariants.map(v => `${v.itemName}${v.price > 0 ? ` +R$${v.price.toFixed(2)}` : ''}`).join(', ')})` 
                    : '';
                const notesSummary = item.notes?.trim() ? `\n  *Obs:* ${item.notes.trim()}` : '';
                return `- ${item.quantity}x ${item.product.name} (R$${item.finalPrice.toFixed(2)})${variantsSummary}${notesSummary}`;
            }).join('\n');

            const paymentText = deliveryType === 'Mesa' ? 'A Combinar no Caixa' : (isMultiPayment 
                ? multiPayments.map(p => {
                    if (p.method === 'Dinheiro' && p.cashAmount) {
                        return `- ${p.method}: R$ ${parseFloat(p.amount).toFixed(2)} (Troco p/ R$ ${parseFloat(p.cashAmount).toFixed(2)})`;
                    }
                    return `- ${p.method}: R$ ${parseFloat(p.amount).toFixed(2)}`;
                }).join('\n')
                : (selectedPayment === 'Dinheiro' && cashAmount ? `Dinheiro (Troco para R$ ${parseFloat(cashAmount).toFixed(2)})` : selectedPayment));

            const message = `*Novo Pedido!* 🎉\n` +
                            `*ID:* ${docRef.id.substring(0, 6).toUpperCase()}\n` +
                            `*Cliente:* ${customerName}\n` +
                            `*WhatsApp:* ${customerPhone}\n\n` +
                            `*Endereço:* ${fullAddress}\n\n` +
                            `--- *Itens* ---\n${itemsSummary}\n\n` +
                            `*Subtotal:* R$${totalPrice.toFixed(2)}\n` +
                            `${deliveryFee > 0 ? `*Entrega:* R$${deliveryFee.toFixed(2)}\n` : ''}` +
                            `*Total:* *R$${finalTotal.toFixed(2)}*\n\n` +
                            `*Pagamento:* \n${paymentText}`;

            const whatsappUrl = `https://wa.me/55${companyData.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
            setWhatsappLink(whatsappUrl);

            // Tenta abrir automaticamente (funciona no Android, bloqueado no iPhone/Safari após async)
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = whatsappUrl;
            } else {
                window.open(whatsappUrl, '_blank');
            }

            // Disparar via API do DeliveryHub (Z-API) em background
            await fetch("/api/whatsapp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: docRef.id,
                    nome: customerName,
                    telefone: customerPhone,
                    telefoneEmpresa: companyData.phone,
                    itens: cartItems.map(item => ({
                        nome: item.product.name,
                        qtd: item.quantity,
                        preco: item.finalPrice,
                        adicionais: item.selectedVariants || []
                    })),
                    total: finalTotal,
                    subtotal: totalPrice,
                    entrega: deliveryFee,
                    pagamento: orderData.paymentMethod,
                    endereco: fullAddress
                })
            });
        }

        setIsOrderFinished(true);
        clearCart();
        setIsCheckoutOpen(false);
        setIsMultiPayment(false);
        setMultiPayments([]);
        setSelectedPayment('');
        setCashAmount('');
    } catch (error: any) {
        console.error('Erro ao enviar pedido:', error);
        const msg = error?.code === 'permission-denied'
            ? 'Permissão negada pelo servidor. Contate o suporte.'
            : error?.message || 'Ocorreu um erro inesperado. Tente novamente.';
        toast({ variant: 'destructive', title: 'Erro ao enviar pedido', description: msg });
    } finally {
        setIsSubmitting(false);
    }
  };

  const enabledPaymentMethods = useMemo(() => {
    const pm = companyData?.paymentMethods || { cash: true, pix: true, credit: true, debit: true };
    const methods = [];
    if (pm.cash) methods.push({ id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign });
    if (pm.pix) methods.push({ id: 'PIX', label: 'PIX', icon: Landmark });
    if (pm.credit) methods.push({ id: 'Cartão de Crédito', label: 'Cartão de Crédito', icon: CreditCard });
    if (pm.debit) methods.push({ id: 'Cartão de Débito', label: 'Cartão de Débito', icon: CreditCard });
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
      <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if(!open) setIsCheckoutOpen(false); }}>
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
                            {(!user || user.isAnonymous) && deliveryType !== 'Delivery' && (
                                <div className="bg-muted/30 p-4 rounded-xl border flex flex-col gap-3">
                                    <div className="text-sm">
                                        <p className="font-semibold text-primary">Já tem uma conta?</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Faça login para acompanhar o pedido e salvar seus dados.</p>
                                    </div>
                                    <div className="w-full flex justify-start">
                                        <CustomerAuthDialog companyId={companyId} />
                                    </div>
                                </div>
                            )}
                            {deliveryType !== 'Delivery' && (
                                <>
                                    <div className="grid gap-2">
                                        <Label>Nome Completo <span className="text-destructive">*</span></Label>
                                        <Input placeholder="Seu nome" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>WhatsApp <span className="text-destructive">*</span></Label>
                                        <Input placeholder="(99) 99999-9999" value={customerPhone} onChange={handlePhoneChange} maxLength={15} />
                                    </div>
                                </>
                            )}
                            {!tableParam && (
                            <>
                            <Separator />
                            <div className="flex gap-2">
                                <Button variant={deliveryType === 'Delivery' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Delivery')}>Delivery</Button>
                                <Button variant={deliveryType === 'Retirada' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Retirada')}>Retirada</Button>
                            </div>
                            </>
                            )}
                            {deliveryType === 'Mesa' && (
                                <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 text-center space-y-1">
                                    <p className="text-xs text-primary font-bold uppercase tracking-wider">Pedido para</p>
                                    <p className="text-3xl font-black text-primary">MESA {tableParam}</p>
                                    {waiterParam && <p className="text-[10px] text-muted-foreground">Atendimento: {waiterParam}</p>}
                                </div>
                            )}

                            {deliveryType === 'Delivery' && (
                                <div className="space-y-3 mt-2">
                                    {(!user || user.isAnonymous) ? (
                                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                                            <div className="bg-background p-3 rounded-full shadow-sm"><MapPin className="h-6 w-6 text-primary" /></div>
                                            <div>
                                                <h3 className="font-bold text-lg text-primary">Login Obrigatório para Delivery</h3>
                                                <p className="text-sm text-muted-foreground mt-1">Para garantir a segurança da entrega e salvar seu endereço, você precisa se identificar.</p>
                                            </div>
                                            <div className="w-full flex justify-center pt-2">
                                                <CustomerAuthDialog companyId={companyId} />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            )}
                            {!tableParam && (
                                <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Pagamento <span className="text-destructive">*</span></h3>
                                </div>

                                <>
                                    <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                                        {enabledPaymentMethods.map(m => (
                                            <div key={m.id} className="flex items-center space-x-2">
                                                <RadioGroupItem value={m.id} id={m.id} /><Label htmlFor={m.id}>{m.label}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                    {selectedPayment === 'Dinheiro' && (
                                        <div className="grid gap-2 pl-6 pt-2">
                                            <Label className="text-xs">Precisa de troco? Troco para quanto? (opcional)</Label>
                                            <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Ex: 50.00 (deixe vazio se não precisar)" />
                                        </div>
                                    )}
                                    {selectedPayment === 'PIX' && companyData?.pixKey && (
                                        <div className="grid gap-2 pl-6 pt-2">
                                            <Label className="text-sm font-semibold text-primary">Chave PIX para pagamento:</Label>
                                            <div className="bg-primary/10 p-3 rounded-md mt-1 mb-2 border border-primary/20">
                                                <p className="font-mono text-sm break-all font-bold select-all">{companyData.pixKey}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">O pedido será liberado após a confirmação do pagamento pelo estabelecimento.</p>
                                        </div>
                                    )}
                                </>
                                </>
                            )}
                        </div>
                    </ScrollArea>
                    <SheetFooter className="pt-4 border-t flex flex-col gap-2">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-muted-foreground"><span>Itens</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                            {deliveryFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>}
                            <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Total</span><span className="text-primary">R$ {finalTotal.toFixed(2)}</span></div>
                        </div>
                        <Button className="w-full h-12 text-lg shadow-md" onClick={handlePlaceOrder} disabled={isSubmitting || isLoadingCompany || (deliveryType === 'Delivery' && (!user || user.isAnonymous))}>
                            {isSubmitting ? 'Processando...' : isLoadingCompany ? 'Carregando...' : (deliveryType === 'Delivery' && (!user || user.isAnonymous)) ? 'Faça login para continuar' : 'Confirmar e Enviar'}
                        </Button>
                        {(!user || user.isAnonymous) && (
                            <p className="text-xs text-center text-muted-foreground mt-2">
                                Dica: Faça login ou crie uma conta para salvar seus dados e histórico de pedidos!
                            </p>
                        )}
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
            <AlertDialogHeader>
                <AlertDialogTitle>Pedido Salvo! 🎉</AlertDialogTitle>
                <AlertDialogDescription>Seu pedido já está no sistema. Clique no botão abaixo para enviar a confirmação ao restaurante pelo WhatsApp.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-3 mt-2">
                <a href={whatsappLink || '#'} target={whatsappLink ? "_blank" : undefined} rel="noopener noreferrer" className="w-full" onClick={() => setIsOrderFinished(false)}>
                    <button className="w-full h-12 text-lg rounded-md bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors">
                        📲 Enviar pelo WhatsApp
                    </button>
                </a>
                <Button variant="outline" onClick={() => { setIsOrderFinished(false); setIsSheetOpen(false); }} className="w-full h-12 text-lg">
                    Voltar ao Cardápio
                </Button>
                <AlertDialogAction onClick={() => setIsOrderFinished(false)} className="w-full">Fechar</AlertDialogAction>
            </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
