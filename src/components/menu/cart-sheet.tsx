
'use client';

import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
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
  AlertDialogCancel,
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
};

type DeliveryZone = {
  id: string;
  neighborhood: string;
  deliveryFee: number;
  deliveryTime: number;
  isActive: boolean;
};

const capitalizeName = (name: string): string => {
    if (!name) return '';
    return name.trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
                        {item.selectedVariants.map(v => v.itemName).join(', ')}
                    </div>
                )}
                <Textarea 
                    placeholder='Observações (ex: sem cebola)'
                    value={item.notes}
                    onChange={(e) => updateNotes(item.id, e.target.value)}
                    className="mt-2 text-sm"
                    rows={1}
                />
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <Minus className="h-4 w-4" />
                </Button>
                <span className="font-bold">{item.quantity}</span>
                 <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Plus className="h-4 w-4" />
                </Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
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

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Retirada'>('Delivery');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressComplement, setAddressComplement] = useState('');

  // Payment State
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [cashAmount, setCashAmount] = useState('');

  const changeFor = useMemo(() => {
    const amount = parseFloat(cashAmount);
    if (!isNaN(amount) && amount > totalPrice) {
        return amount - totalPrice;
    }
    return 0;
  }, [cashAmount, totalPrice]);

  const handlePlaceOrder = async () => {
    if (!firestore || !companyId) return;

    if (!selectedPayment) {
      toast({
        variant: 'destructive',
        title: 'Forma de pagamento',
        description: 'Por favor, selecione uma forma de pagamento.',
      });
      return;
    }

    let paymentMethodsStr = selectedPayment;

    if (selectedPayment === 'Dinheiro' && cashAmount) {
        paymentMethodsStr = `Dinheiro (troco para R$ ${parseFloat(cashAmount).toFixed(2)})`;
    }

    let isFormValid = customerName && customerPhone;
    if (deliveryType === 'Delivery' && (!addressStreet || !addressNumber || !addressNeighborhood)) {
      isFormValid = false;
    }

    if (!isFormValid) {
        toast({
            variant: 'destructive',
            title: 'Campos obrigatórios',
            description: 'Por favor, preencha nome, telefone e endereço (se delivery).',
        });
        return;
    }
    
    const ordersRef = collection(firestore, 'companies', companyId, 'orders');

    const fullAddress = deliveryType === 'Delivery'
      ? `${addressStreet}, ${addressNumber} - ${addressNeighborhood}${addressComplement ? ` (${addressComplement})` : ''}`
      : 'Retirada no local';

    const orderData = {
        companyId: companyId,
        customerId: user?.uid || 'anonymous',
        customerName: capitalizeName(customerName) || 'Anônimo',
        customerPhone: customerPhone,
        orderDate: serverTimestamp(),
        status: 'Novo',
        deliveryAddress: fullAddress,
        deliveryType: deliveryType,
        paymentMethod: paymentMethodsStr,
        orderItems: cartItems.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            finalPrice: item.finalPrice,
            notes: item.notes || '',
            selectedVariants: item.selectedVariants || [],
        })),
        totalAmount: totalPrice,
    };
    
    try {
        await addDocument(ordersRef, orderData);
        setIsOrderFinished(true);
        clearCart();
        // Reset local form state
        setCustomerName('');
        setCustomerPhone('');
        setAddressStreet('');
        setAddressNumber('');
        setAddressNeighborhood('');
        setAddressComplement('');
        setSelectedPayment('');
        setCashAmount('');
        setIsCheckoutOpen(false);
    } catch (error) {
        console.error("Error placing order:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao enviar pedido',
            description: 'Não foi possível completar seu pedido. Tente novamente.',
        });
    }
  };

  const handleSheetOpenChange = (open: boolean) => {
    if(!open) {
        setIsCheckoutOpen(false);
    }
  }

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

  const renderCartContent = () => (
    <>
      <SheetHeader>
        <SheetTitle>Seu Carrinho</SheetTitle>
      </SheetHeader>
      {cartItems.length > 0 ? (
        <div className="flex flex-1 flex-col justify-between">
          <ScrollArea className="flex-grow pr-4">
            <div className="space-y-4 py-4">
              {cartItems.map(item => (
                <CartItemCard key={item.id} item={item} />
              ))}
            </div>
          </ScrollArea>
          <SheetFooter className="flex-col space-y-4 !space-x-0 pt-4 border-t">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>R$ {totalPrice.toFixed(2)}</span>
            </div>
            <Button size="lg" className="w-full" onClick={() => setIsCheckoutOpen(true)}>
              Finalizar Pedido
            </Button>
          </SheetFooter>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-semibold">Seu carrinho está vazio</p>
            <p className="text-sm text-muted-foreground">Adicione produtos do cardápio para começar.</p>
        </div>
      )}
    </>
  );

  const renderCheckoutContent = () => (
     <>
      <SheetHeader>
        <SheetTitle>Finalizar Pedido</SheetTitle>
      </SheetHeader>
        <ScrollArea className="flex-grow pr-4 -mx-6 px-6">
            <div className="space-y-4 py-4">
                <h3 className="font-semibold">Seus Dados</h3>
                <div className="grid gap-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Seu nome completo" required />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="phone">WhatsApp</Label>
                    <Input id="phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(99) 99999-9999" required />
                </div>
                 <Separator className="my-4" />
                 <h3 className="font-semibold">Entrega</h3>
                 <div className="flex gap-4">
                    <Button variant={deliveryType === 'Delivery' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Delivery')}>Delivery</Button>
                    <Button variant={deliveryType === 'Retirada' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Retirada')}>Retirada</Button>
                 </div>
                 {deliveryType === 'Delivery' && (
                     <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-2 col-span-2">
                                <Label htmlFor="address-street">Rua</Label>
                                <Input id="address-street" value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Ex: Av. Brasil" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address-number">Número</Label>
                                <Input id="address-number" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} placeholder="Ex: 123" required />
                            </div>
                             <div className="grid gap-2">
                                <Label htmlFor="address-complement">Complemento</Label>
                                <Input id="address-complement" value={addressComplement} onChange={e => setAddressComplement(e.target.value)} placeholder="Ex: Apto 101" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address-neighborhood">Bairro</Label>
                            <Select value={addressNeighborhood} onValueChange={setAddressNeighborhood}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o bairro" />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingZones ? (
                                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                                ) : activeDeliveryZones.length > 0 ? (
                                  activeDeliveryZones.map(zone => (
                                    <SelectItem key={zone.id} value={zone.neighborhood}>{zone.neighborhood}</SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-zones" disabled>Nenhum bairro disponível</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                        </div>
                    </div>
                 )}
                <Separator className="my-4" />
                 <div className="space-y-3">
                    <h3 className="font-semibold">Forma de Pagamento</h3>
                     {isLoadingCompany ? (
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-6 w-1/2" />
                        </div>
                    ) : (
                      <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment} className="space-y-4">
                          {enabledPaymentMethods.map(({ id, label, icon: Icon }) => (
                            <div key={id}>
                              <div className="flex items-center space-x-3">
                                <RadioGroupItem value={id} id={`payment-${id}`} />
                                <Label htmlFor={`payment-${id}`} className="flex items-center gap-2 font-normal flex-grow cursor-pointer">
                                  <Icon className="h-5 w-5 text-muted-foreground" />
                                  {label}
                                </Label>
                              </div>
                            </div>
                          ))}
                          {selectedPayment === 'Dinheiro' && companyData?.paymentMethods?.cashAskForChange && (
                            <div className="grid gap-2 pl-9 pt-2">
                                <Label htmlFor="cash-amount">Precisa de troco para quanto? (Opcional)</Label>
                                <Input id="cash-amount" type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Ex: 50.00" />
                                {changeFor > 0 && (
                                    <p className="text-sm text-green-600 font-medium">Seu troco será de R$ {changeFor.toFixed(2)}</p>
                                )}
                            </div>
                          )}
                          {enabledPaymentMethods.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento configurada pela loja.</p>}
                      </RadioGroup>
                    )}
                </div>
                 <Separator className="my-4" />
                 <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total do Pedido</span>
                        <span>R$ {totalPrice.toFixed(2)}</span>
                    </div>
                 </div>
            </div>
        </ScrollArea>
        <SheetFooter className="flex-col space-y-4 !space-x-0 pt-4 border-t">
            <Button size="lg" className="w-full" onClick={handlePlaceOrder}>
                Enviar Pedido
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setIsCheckoutOpen(false)}>
                Voltar para o Carrinho
            </Button>
        </SheetFooter>
    </>
  );

  return (
    <>
      <Sheet onOpenChange={handleSheetOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="default"
            className="fixed bottom-6 right-6 z-20 h-16 w-16 rounded-full shadow-lg"
          >
            <ShoppingCart className="h-8 w-8" />
            {totalItems > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full"
              >
                {totalItems}
              </Badge>
            )}
            <span className="sr-only">Abrir carrinho</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col">
            {isCheckoutOpen ? renderCheckoutContent() : renderCartContent()}
        </SheetContent>
      </Sheet>

        <AlertDialog open={isOrderFinished} onOpenChange={setIsOrderFinished}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Pedido Enviado com Sucesso!</AlertDialogTitle>
                <AlertDialogDescription>
                    Seu pedido foi recebido e já está sendo preparado. Você receberá atualizações sobre o status em breve.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setIsOrderFinished(false)}>Entendido!</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
