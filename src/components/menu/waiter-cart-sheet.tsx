'use client';

import { useState, useEffect, Suspense } from 'react';
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
import { Trash2, LogOut, ShieldCheck, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useFirestore, addDocument, useUser } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
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

export default function WaiterCartSheet({ companyId }: { companyId: string}) {
  const { cartItems, totalItems, totalPrice, clearCart } = useCart();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isOrderFinished, setIsOrderFinished] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const [waiterSession, setWaiterSession] = useState<{id: string, name: string, pin: string} | null>(null);

  const searchParams = useSearchParams();
  const urlTable = searchParams?.get('table') ?? null;
  const urlWaiter = searchParams?.get('waiter') ?? null;
  const isAdminSession = searchParams?.get('admin') === 'true';
  const { user } = useUser();

  const [tableNumber, setTableNumber] = useState(urlTable || '');
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (urlTable) {
        setTableNumber(urlTable);
    }
  }, [urlTable]);

  useEffect(() => {
    if (isAdminSession) {
        setWaiterSession({id: 'admin', name: 'Administrador(a)', pin: ''});
        return;
    }
    if (urlWaiter) {
        setWaiterSession({id: 'url_waiter', name: urlWaiter, pin: ''});
        return;
    }
    const session = localStorage.getItem(`waiter_session_${companyId}`);
    if (session) {
        setWaiterSession(JSON.parse(session));
    } else {
        router.push(`/waiter/${companyId}`);
    }
  }, [companyId, router, isAdminSession, urlWaiter]);

  const finalTotal = totalPrice; // No delivery fee for tables

  const handlePlaceOrder = async () => {
    if (!firestore || !companyId || !waiterSession) return;

    if (!tableNumber.trim()) {
        toast({ variant: 'destructive', title: 'Número da Mesa Obrigatório' });
        return;
    }
    
    const ordersRef = collection(firestore, 'companies', companyId, 'orders');

    const orderData = {
        companyId,
        customerId: 'waiter_system',
        customerName: customerName.trim() || 'Cliente na Mesa',
        customerPhone: '',
        orderDate: serverTimestamp(),
        status: 'Novo',
        deliveryAddress: `Mesa ${tableNumber.trim()}`,
        deliveryType: 'Mesa',
        tableNumber: tableNumber.trim(),
        waiterName: waiterSession.name,
        deliveryFee: 0,
        paymentMethod: 'A Combinar',
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
        await addDocument(ordersRef, orderData);
        setIsOrderFinished(true);
        clearCart();
        setIsCheckoutOpen(false);
        if (!urlTable) setTableNumber('');
        setCustomerName('');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao lançar comanda' });
    }
  };

  const handleLogout = () => {
      if (isAdminSession) {
          router.push('/dashboard/comandas');
          return;
      }
      localStorage.removeItem(`waiter_session_${companyId}`);
      router.push(`/waiter/${companyId}`);
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
          <Badge className={`px-3 py-1 shadow-md text-background ${isAdminSession ? 'bg-primary' : 'bg-foreground'}`}>
            {isAdminSession && <ShieldCheck className="w-3 h-3 mr-1 inline" />}
            {isAdminSession ? 'Modo Admin' : `Garçom: ${waiterSession?.name || '...'}`}
          </Badge>
          <Button variant="secondary" size="icon" onClick={handleLogout} className="rounded-full shadow-md bg-red-100 text-red-600 hover:bg-red-200" title={isAdminSession ? "Voltar ao painel" : "Sair do Modo Garçom"}>
              <LogOut className="h-4 w-4" />
          </Button>
      </div>

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
                    <SheetHeader><SheetTitle>Lançar Comanda na Mesa</SheetTitle></SheetHeader>
                    <ScrollArea className="flex-grow pr-4">
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label className="text-lg">Número da Mesa <span className="text-destructive">*</span></Label>
                                <Input 
                                    placeholder="Ex: 05, 12, Varanda" 
                                    className={`text-2xl h-14 ${urlTable ? 'bg-muted text-muted-foreground' : ''}`} 
                                    value={tableNumber} 
                                    readOnly={!!urlTable}
                                    onChange={e => setTableNumber(e.target.value)} 
                                    autoFocus={!urlTable}
                                />
                            </div>
                            <div className="grid gap-2 mt-4">
                                <Label>Nome do Cliente (Opcional)</Label>
                                <Input placeholder="Para facilitar a identificação" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                            </div>
                        </div>
                    </ScrollArea>
                    <SheetFooter className="pt-4 border-t flex flex-col sm:flex-col sm:space-x-0 gap-2">
                        <div className="space-y-1 text-sm w-full">
                            <div className="flex justify-between font-bold text-xl pt-1"><span>Total do Pedido</span><span className="text-primary">R$ {finalTotal.toFixed(2)}</span></div>
                        </div>
                        <Button className="w-full h-14 text-xl shadow-md mt-2" onClick={handlePlaceOrder}>Enviar para a Cozinha</Button>
                        <Button variant="ghost" className="w-full mt-1" onClick={() => setIsCheckoutOpen(false)}>Voltar aos Itens</Button>
                    </SheetFooter>
                </>
            ) : (
                <>
                    <SheetHeader><SheetTitle>Comanda Atual</SheetTitle></SheetHeader>
                    <ScrollArea className="flex-grow"><div className="space-y-4 py-4">{cartItems.length > 0 ? cartItems.map(item => <CartItemCard key={item.id} item={item} />) : <p className="text-center text-muted-foreground py-8">Nenhum item adicionado na comanda.</p>}</div></ScrollArea>
                    <SheetFooter className="pt-4 border-t flex flex-col sm:flex-col sm:space-x-0 gap-2">
                        <div className="flex justify-between font-bold text-lg w-full"><span>Subtotal</span><span>R$ {totalPrice.toFixed(2)}</span></div>
                        <Button className="w-full h-12 text-lg" onClick={() => setIsCheckoutOpen(true)} disabled={cartItems.length === 0}>Lançar Pedido</Button>
                    </SheetFooter>
                </>
            )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={isOrderFinished} onOpenChange={setIsOrderFinished}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Comanda Lançada!</AlertDialogTitle><AlertDialogDescription>O pedido da Mesa {tableNumber} foi enviado para a cozinha com sucesso.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogAction onClick={() => setIsOrderFinished(false)}>Fazer Novo Pedido</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
