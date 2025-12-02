
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

type PaymentMethods = {
  cash: boolean;
  pix: boolean;
  credit: boolean;
  debit: boolean;
};

type CompanyData = {
    paymentMethods?: PaymentMethods;
};


const CartItemCard = ({ item }: { item: CartItem }) => {
    const { updateQuantity, removeFromCart, updateNotes } = useCart();
    
    return (
        <div className="flex items-start gap-4">
            <div className="flex-grow">
                <p className="font-semibold">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">R$ {item.product.price.toFixed(2)}</p>
                <Textarea 
                    placeholder='Observações (ex: sem cebola)'
                    value={item.notes}
                    onChange={(e) => updateNotes(item.product.id, e.target.value)}
                    className="mt-2 text-sm"
                    rows={1}
                />
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                    <Minus className="h-4 w-4" />
                </Button>
                <span className="font-bold">{item.quantity}</span>
                 <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                    <Plus className="h-4 w-4" />
                </Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default function CartSheet({ companyId }: { companyId: string}) {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return doc(firestore, 'companies', companyId);
  }, [firestore, companyId]);

  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanyData>(companyRef);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'Delivery' | 'Retirada'>('Delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  
  const handlePlaceOrder = async () => {
    if (!firestore || !companyId) return;

    if (!customerName || !customerPhone || !paymentMethod || (deliveryType === 'Delivery' && !deliveryAddress)) {
        toast({
            variant: 'destructive',
            title: 'Campos obrigatórios',
            description: 'Por favor, preencha todos os campos para finalizar o pedido.',
        });
        return;
    }

    const ordersRef = collection(firestore, 'companies', companyId, 'orders');

    const orderData = {
        companyId: companyId,
        customerId: customerPhone || 'anonymous',
        customerName: customerName || 'Anônimo',
        customerPhone: customerPhone,
        orderDate: serverTimestamp(),
        status: 'Novo',
        deliveryAddress: deliveryType === 'Delivery' ? deliveryAddress : 'Retirada no local',
        deliveryType: deliveryType,
        paymentMethod: paymentMethod,
        orderItems: cartItems.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            notes: item.notes || '',
        })),
        totalAmount: totalPrice,
    };
    
    try {
        await addDocument(ordersRef, orderData);
        setIsOrderFinished(true);
        clearCart();
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
                <CartItemCard key={item.product.id} item={item} />
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
                 {/* Simple radio buttons for now */}
                 <div className="flex gap-4">
                    <Button variant={deliveryType === 'Delivery' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Delivery')}>Delivery</Button>
                    <Button variant={deliveryType === 'Retirada' ? 'default' : 'outline'} className="flex-1" onClick={() => setDeliveryType('Retirada')}>Retirada</Button>
                 </div>
                 {deliveryType === 'Delivery' && (
                     <div className="grid gap-2">
                        <Label htmlFor="address">Endereço de Entrega</Label>
                        <Textarea id="address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Rua, número, bairro, cidade..." required />
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
                        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                            {enabledPaymentMethods.map(({ id, label, icon: Icon }) => (
                                <div key={id} className="flex items-center space-x-2">
                                    <RadioGroupItem value={id} id={id} />
                                    <Label htmlFor={id} className="flex items-center gap-2 font-normal">
                                      <Icon className="h-5 w-5 text-muted-foreground" />
                                      {label}
                                    </Label>
                                </div>
                            ))}
                            {enabledPaymentMethods.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma forma de pagamento configurada pela loja.</p>}
                        </RadioGroup>
                    )}
                </div>
            </div>
        </ScrollArea>
        <SheetFooter className="flex-col space-y-4 !space-x-0 pt-4 border-t">
            <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {totalPrice.toFixed(2)}</span>
            </div>
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
