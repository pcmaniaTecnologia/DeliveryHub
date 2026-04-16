
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Smartphone, CreditCard, DollarSign, Landmark, CheckCircle2, Printer, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, updateDocument } from '@/firebase';
import { collection, serverTimestamp, doc, increment, getDocs, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';
import { useImpersonation } from '@/context/impersonation-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { recordCashierSale } from '@/lib/finance-utils';

type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    stock: number;
    stockControlEnabled?: boolean;
    imageUrls: string[];
    isSoldByWeight?: boolean;
}

type Category = {
    id: string;
    name: string;
}

type CartItem = {
    id: string;
    product: Product;
    quantity: number;
    finalPrice: number;
    selectedVariants?: any[]; // Simplified for now
}

export default function POSPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { isImpersonating, impersonatedCompanyId } = useImpersonation();
    const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

    // Data Fetching
    const productsRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return collection(firestore, `companies/${effectiveCompanyId}/products`);
    }, [firestore, effectiveCompanyId]);
    const { data: productsData, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

    const categoriesRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return collection(firestore, `companies/${effectiveCompanyId}/categories`);
    }, [firestore, effectiveCompanyId]);
    const { data: categoriesData, isLoading: isLoadingCategories } = useCollection<Category>(categoriesRef);

    // Refs for keyboard shortcuts
    const searchInputRef = useRef<HTMLInputElement>(null);
    const customerNameRef = useRef<HTMLInputElement>(null);

    // State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Checkout State
    const [customerName, setCustomerName] = useState('Consumidor');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
    const [currentWeight, setCurrentWeight] = useState('1.000');
    const [selectedProductForWeight, setSelectedProductForWeight] = useState<Product | null>(null);
    const [discount, setDiscount] = useState('0.00');
    const [amountReceived, setAmountReceived] = useState('');

    // Multi-payment state
    const [isMultiPayment, setIsMultiPayment] = useState(false);
    const [payments, setPayments] = useState<{ method: string, amount: number, received?: number }[]>([]);

    // Filtered Products
    const filteredProducts = useMemo(() => {
        if (!productsData) return [];
        return productsData.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;
            return p.isActive && matchesSearch && matchesCategory;
        });
    }, [productsData, searchQuery, selectedCategory]);

    const activeProducts = useMemo(() => productsData?.filter(p => p.isActive) || [], [productsData]);

    // Cart Logic
    const addToCart = (product: Product, weight?: number) => {
        if (product.isSoldByWeight && weight === undefined) {
            setSelectedProductForWeight(product);
            setCurrentWeight('1.000');
            setIsWeightDialogOpen(true);
            return;
        }

        const qtyToAdd = weight !== undefined ? weight : 1;

        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id && !product.isSoldByWeight);
            if (existing && !product.isSoldByWeight) {
                return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + qtyToAdd } : item);
            }
            return [...prev, { id: `${product.id}-${Date.now()}`, product, quantity: qtyToAdd, finalPrice: product.price }];
        });
    };

    const handleWeightConfirm = () => {
        if (!selectedProductForWeight) return;
        const weight = parseFloat(currentWeight.replace(',', '.'));
        if (isNaN(weight) || weight <= 0) {
            toast({ variant: 'destructive', title: 'Peso inválido' });
            return;
        }
        addToCart(selectedProductForWeight, weight);
        setIsWeightDialogOpen(false);
        setSelectedProductForWeight(null);
    };

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.id !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === cartItemId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const updateItemPrice = (cartItemId: string, newPrice: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === cartItemId) {
                return { ...item, finalPrice: newPrice };
            }
            return item;
        }));
    };

    const total = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    const totalWithDiscount = Math.max(0, total - parseFloat(discount || '0'));
    const change = Math.max(0, (parseFloat(amountReceived || '0')) - totalWithDiscount);

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F3 - Focus Search
            if (e.key === 'F3') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            // F9 - Finalize
            if (e.key === 'F9') {
                e.preventDefault();
                if (isCheckoutOpen) {
                    handleCheckout();
                } else if (cart.length > 0 && !isSuccessOpen) {
                    setIsCheckoutOpen(true);
                }
            }
            // F2 - Customer Name (only if checkout is open)
            if (e.key === 'F2') {
                e.preventDefault();
                if (isCheckoutOpen) {
                    customerNameRef.current?.focus();
                }
            }
            // Esc - Close everything
            if (e.key === 'Escape') {
                if (isCheckoutOpen) setIsCheckoutOpen(false);
                if (isSuccessOpen) setIsSuccessOpen(false);
                if (isWeightDialogOpen) setIsWeightDialogOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCheckoutOpen, cart.length, isSuccessOpen, isWeightDialogOpen, customerName, customerPhone, paymentMethod, discount, amountReceived, isMultiPayment, payments]);

    const handleCheckout = async () => {
        if (!firestore || !user || cart.length === 0) return;
        setIsSubmitting(true);

        try {
            const ordersRef = collection(firestore, 'companies', effectiveCompanyId as string, 'orders');

            const fullPaymentMethod = isMultiPayment
                ? payments
                    .map((p) => {
                        if (p.method === 'Dinheiro' && p.received && p.received > p.amount) {
                            return `${p.method}: R$ ${p.amount.toFixed(2)} (Rec: R$ ${p.received.toFixed(
                                2
                            )}, Troco: R$ ${(p.received - p.amount).toFixed(2)})`;
                        }
                        return `${p.method}: R$ ${p.amount.toFixed(2)}`;
                    })
                    .join(' | ')
                : paymentMethod === 'Dinheiro' && amountReceived
                    ? `Dinheiro (Troco para R$ ${parseFloat(amountReceived).toFixed(2)})`
                    : paymentMethod;

            const orderData = {
                companyId: effectiveCompanyId,
                customerId: 'balcao',
                customerName: customerName.trim() || 'Consumidor',
                customerPhone: customerPhone.trim(),
                orderDate: serverTimestamp(),
                status: 'Finalizado',
                deliveryAddress: 'Venda de Balcão',
                deliveryType: 'Balcão',
                deliveryFee: 0,
                paymentMethod: fullPaymentMethod,
                discount: parseFloat(discount || '0'),
                orderItems: cart.map((item) => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.product.price,
                    finalPrice: item.finalPrice,
                    notes: '',
                })),
                totalAmount: totalWithDiscount,
                subtotal: total,
                origin: 'PDV',
                amountReceived: isMultiPayment
                    ? payments.find((p) => p.method === 'Dinheiro')?.received || 0
                    : parseFloat(amountReceived || '0'),
                change: isMultiPayment
                    ? payments.reduce(
                        (acc, p) =>
                            acc +
                            (p.method === 'Dinheiro' && p.received
                                ? Math.max(0, p.received - p.amount)
                                : 0),
                        0
                    )
                    : change,
                payments: isMultiPayment
                    ? payments
                    : [{ method: paymentMethod, amount: totalWithDiscount, received: parseFloat(amountReceived || '0') }],
            };

            const docRef = await addDocument(ordersRef, orderData);

            try {
                const result = await recordCashierSale(
                    firestore,
                    effectiveCompanyId as string,
                    totalWithDiscount,
                    `Venda de Balcão #${docRef.id.substring(0, 6).toUpperCase()}`,
                    docRef.id,
                    fullPaymentMethod
                );

                if (result && result.success) {
                    if (result.sessionId) {
                        const orderRef = doc(
                            firestore,
                            'companies',
                            effectiveCompanyId as string,
                            'orders',
                            docRef.id
                        );
                        await updateDocument(orderRef, { sessionId: result.sessionId });
                    }
                } else {
                    console.warn('Venda não vinculada ao caixa (caixa pode estar fechado)');
                    toast({
                        variant: 'destructive',
                        title: 'Aviso de Caixa',
                        description:
                            'A venda foi salva, mas não foi possível vincular ao caixa (verifique se há um caixa aberto).',
                    });
                }
            } catch (cashierError) {
                console.error('Erro ao vincular venda ao caixa:', cashierError);
                toast({
                    variant: 'destructive',
                    title: 'Erro no Caixa',
                    description: 'A venda foi salva, mas houve um erro ao registrar no caixa.',
                });
            }

            const stockItems = cart
                .filter((item) => item.product.stockControlEnabled)
                .map((item) => ({ productId: item.product.id, quantity: item.quantity }));

            if (stockItems.length > 0) {
                try {
                    await Promise.all(
                        stockItems.map((item) => {
                            const productRef = doc(
                                firestore,
                                'companies',
                                user.uid,
                                'products',
                                item.productId
                            );
                            return updateDocument(productRef, { stock: increment(-item.quantity) });
                        })
                    );
                } catch (stockError) {
                    console.error('Falha ao baixar estoque direto:', stockError);
                    toast({
                        variant: 'destructive',
                        title: 'Aviso de Estoque',
                        description: 'A venda foi salva, mas houve um erro ao atualizar o estoque.',
                    });
                }
            }

            setLastOrder({ ...orderData, id: docRef.id });
            setCart([]);
            setIsCheckoutOpen(false);
            setIsSuccessOpen(true);
            setCustomerName('Consumidor');
            setCustomerPhone('');
            setPaymentMethod('Dinheiro');
            setDiscount('0.00');
            setAmountReceived('');
            setIsMultiPayment(false);
            setPayments([]);
            setSearchQuery('');
            setSelectedCategory(null);

            toast({ title: 'Venda Finalizada!', description: 'O pedido foi registrado com sucesso.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Erro ao finalizar venda' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('receipt-content');
        if (!printContent) return;

        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Impressão de Cupom</title>
                        <style>
                            @page { size: auto; margin: 0; }
                            body { 
                                font-family: 'Courier New', Courier, monospace; 
                                width: 80mm; 
                                padding: 10px; 
                                font-size: 12px;
                                line-height: 1.2;
                            }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .divider { border-top: 1px dashed #000; margin: 5px 0; }
                            .item { display: flex; justify-content: space-between; }
                            .total { font-size: 14px; font-weight: bold; margin-top: 5px; }
                        </style>
                    </head>
                    <body>
                        ${printContent.innerHTML}
                        <script>
                            window.onload = function() {
                                window.print();
                                window.close();
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    if (isUserLoading || isLoadingProducts) return <div className="p-8 text-center text-muted-foreground">Carregando PDV...</div>;

    const renderProductSection = () => (
        <div className="flex-[2] flex flex-col gap-4 h-full min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="p-4 bg-muted/30">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Buscar produto... [F3]"
                                className="pl-9"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full sm:max-w-[400px]">
                            <Button
                                variant={selectedCategory === null ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedCategory(null)}
                            >
                                Tudo
                            </Button>
                            {categoriesData?.map(cat => (
                                <Button
                                    key={cat.id}
                                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                                    size="sm"
                                    className="whitespace-nowrap"
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="group relative flex flex-col border rounded-lg p-2 sm:p-3 cursor-pointer hover:border-primary transition-all hover:bg-primary/5 active:scale-95"
                            >
                                <div className="relative aspect-square w-full mb-2 sm:mb-3 rounded-md overflow-hidden bg-muted">
                                    {product.imageUrls?.[0] ? (
                                        <Image
                                            src={product.imageUrls[0]}
                                            alt={product.name}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Package className="h-6 w-6 sm:h-8 sm:w-8 opacity-20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col h-full">
                                    <h3 className="font-semibold text-[10px] sm:text-xs md:text-sm line-clamp-2 mb-1 leading-tight sm:leading-normal">{product.name}</h3>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto gap-1">
                                        <span className="text-primary font-bold text-xs sm:text-sm">R$ {product.price.toFixed(2)}</span>
                                        {product.stockControlEnabled && (
                                            <Badge variant={product.stock > 0 ? 'secondary' : 'destructive'} className="text-[8px] sm:text-[10px] w-fit px-1">
                                                Estoque: {product.stock}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredProducts.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                            <Search className="h-12 w-12" />
                            <p>Nenhum produto encontrado.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    const renderCartSection = () => (
        <div className="flex-1 flex flex-col min-w-0 xl:min-w-[320px] h-full overflow-hidden">
            <Card className="flex-1 flex flex-col overflow-hidden border-2 border-primary/20">
                <CardHeader className="p-3 sm:p-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" /> Carrinho
                    </CardTitle>
                    <Badge variant="secondary">{cart.length} itens</Badge>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                            {cart.map(item => (
                                <div key={item.id} className="flex gap-2 sm:gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-xs sm:text-sm truncate">{item.product.name}</p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                                            {item.product.isSoldByWeight
                                                ? `${item.quantity.toFixed(3)}kg x R$ ${item.product.price.toFixed(2)}`
                                                : `R$ ${item.finalPrice.toFixed(2)} x ${item.quantity}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <div className="flex flex-col items-end gap-1">
                                            {!item.product.isSoldByWeight ? (
                                                <div className="flex items-center border rounded-md px-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQuantity(item.id, -1)}>
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-bold">{item.quantity}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" onClick={() => updateQuantity(item.id, 1)}>
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button variant="outline" size="sm" className="h-7 text-[9px] sm:text-[10px]" onClick={() => {
                                                    setSelectedProductForWeight(item.product);
                                                    setCurrentWeight(item.quantity.toFixed(3));
                                                    setIsWeightDialogOpen(true);
                                                    removeFromCart(item.id);
                                                }}>
                                                    Peso
                                                </Button>
                                            )}

                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-muted-foreground">R$</span>
                                                <input
                                                    type="number"
                                                    className="w-12 sm:w-16 h-5 sm:h-6 text-[10px] sm:text-xs text-right border rounded bg-muted/50 px-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                                    value={item.finalPrice}
                                                    onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive" onClick={() => removeFromCart(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="py-10 sm:py-20 text-center text-muted-foreground opacity-30 flex flex-col items-center">
                                    <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 mb-2" />
                                    <p className="text-sm">Carrinho vazio</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 bg-muted/10 border-t">
                    <div className="w-full space-y-1 sm:space-y-2">
                        <div className="flex justify-between items-center text-xs sm:text-sm">
                            <span>Subtotal</span>
                            <span>R$ {total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center font-bold text-lg sm:text-xl text-primary">
                            <span>Total</span>
                            <span>R$ {total.toFixed(2)}</span>
                        </div>
                    </div>
                    <Button
                        className="w-full h-10 sm:h-14 text-base sm:text-lg font-bold gap-2"
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                    >
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> Finalizar [F9]
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-[10px] sm:text-xs"
                        disabled={cart.length === 0}
                        onClick={() => setCart([])}
                    >
                        Limpar Carrinho
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4 pb-16 sm:pb-0">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Venda de Balcão (PDV)</h2>
                    <p className="text-muted-foreground text-xs sm:text-sm">Realize vendas rápidas presencialmente.</p>
                </div>
            </div>

            {/* Content for both Mobile (Tabs) and Desktop (Side-by-side) */}
            {/* We define them once for clean code, or use them conditionally */}

            <Tabs defaultValue="products" className="flex-1 flex flex-col overflow-hidden xl:hidden">
                <TabsList className="grid w-full grid-cols-2 mb-2">
                    <TabsTrigger value="products">Produtos</TabsTrigger>
                    <TabsTrigger value="cart" className="relative">
                        Carrinho
                        {cart.length > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                                {cart.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="flex-1 flex flex-col overflow-hidden m-0">
                    {renderProductSection()}
                </TabsContent>

                <TabsContent value="cart" className="flex-1 flex flex-col overflow-hidden m-0">
                    {renderCartSection()}
                </TabsContent>
            </Tabs>

            <div className="hidden xl:flex flex-1 gap-4 overflow-hidden">
                {renderProductSection()}
                {renderCartSection()}
            </div>

            {/* Mobile Bottom Bar */}
            {cart.length > 0 && (
                <div className="xl:hidden fixed bottom-0 left-0 right-0 p-3 bg-background border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex items-center justify-between z-40">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</span>
                        <span className="text-xl font-bold text-primary">R$ {total.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button size="lg" className="font-bold h-12 px-6" onClick={() => setIsCheckoutOpen(true)}>
                            Pagar
                        </Button>
                    </div>
                </div>
            )}

            {/* Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Finalizar Pagamento</DialogTitle>
                        <DialogDescription>Selecione a forma de pagamento e identifique o cliente se necessário.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="space-y-4">
                            <Label>Identificação do Cliente (Opcional)</Label>
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cust-name" className="text-xs text-muted-foreground">Nome [F2]</Label>
                                    <Input
                                        id="cust-name"
                                        ref={customerNameRef}
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        placeholder="Ex: Consumidor"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cust-phone" className="text-xs text-muted-foreground">WhatsApp</Label>
                                    <Input id="cust-phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(99) 99999-9999" />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <Label className="text-primary font-bold">Resumo Financeiro</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="discount" className="text-xs text-muted-foreground">Desconto (R$)</Label>
                                    <Input
                                        id="discount"
                                        type="number"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value)}
                                        placeholder="0.00"
                                        className="border-primary/20"
                                    />
                                </div>
                                <div className="space-y-2 flex flex-col justify-end">
                                    <div className="bg-primary/5 p-2 rounded border border-primary/10 text-right">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Total a Pagar</p>
                                        <p className="text-lg font-black text-primary">R$ {totalWithDiscount.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Forma de Pagamento</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[10px] h-7 px-2 border"
                                    onClick={() => {
                                        setIsMultiPayment(!isMultiPayment);
                                        if (!isMultiPayment) {
                                            setPayments([{ method: paymentMethod, amount: totalWithDiscount }]);
                                        }
                                    }}
                                >
                                    {isMultiPayment ? 'Voltar para Único' : 'Dividir Pagamento'}
                                </Button>
                            </div>

                            {!isMultiPayment ? (
                                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-4">
                                    <div>
                                        <RadioGroupItem value="Dinheiro" id="cash" className="peer sr-only" />
                                        <Label
                                            htmlFor="cash"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                        >
                                            <DollarSign className="mb-2 h-5 w-5" />
                                            <span className="text-xs">Dinheiro</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="PIX" id="pix" className="peer sr-only" />
                                        <Label
                                            htmlFor="pix"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                        >
                                            <Landmark className="mb-2 h-5 w-5" />
                                            <span className="text-xs">PIX</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="Cartão de Crédito" id="credit" className="peer sr-only" />
                                        <Label
                                            htmlFor="credit"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                        >
                                            <CreditCard className="mb-2 h-5 w-5" />
                                            <span className="text-xs">C. Crédito</span>
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="Cartão de Débito" id="debit" className="peer sr-only" />
                                        <Label
                                            htmlFor="debit"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                        >
                                            <CreditCard className="mb-2 h-5 w-5" />
                                            <span className="text-xs">C. Débito</span>
                                        </Label>
                                    </div>
                                </RadioGroup>
                            ) : (
                                <div className="space-y-3">
                                    {payments.map((p, idx) => (
                                        <div key={idx} className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="flex-1 h-9 rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                    value={p.method}
                                                    onChange={(e) => {
                                                        const newPayments = [...payments];
                                                        newPayments[idx].method = e.target.value;
                                                        setPayments(newPayments);
                                                    }}
                                                >
                                                    <option value="Dinheiro">Dinheiro</option>
                                                    <option value="PIX">PIX</option>
                                                    <option value="Cartão de Crédito">C. Crédito</option>
                                                    <option value="Cartão de Débito">C. Débito</option>
                                                </select>
                                                <Input
                                                    type="number"
                                                    className="w-24 h-9"
                                                    value={p.amount}
                                                    onChange={(e) => {
                                                        const newPayments = [...payments];
                                                        newPayments[idx].amount = parseFloat(e.target.value) || 0;
                                                        setPayments(newPayments);
                                                    }}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-destructive"
                                                    onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {p.method === 'Dinheiro' && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Label className="text-[10px] whitespace-nowrap">Recebido (Troco):</Label>
                                                    <Input
                                                        type="number"
                                                        className="h-7 text-xs"
                                                        placeholder="0.00"
                                                        value={p.received || ''}
                                                        onChange={(e) => {
                                                            const newPayments = [...payments];
                                                            newPayments[idx].received = parseFloat(e.target.value) || 0;
                                                            setPayments(newPayments);
                                                        }}
                                                    />
                                                    {p.received && p.received > p.amount && (
                                                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                                            Troco: R$ {(p.received - p.amount).toFixed(2)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs gap-1 border-dashed"
                                        onClick={() => {
                                            const currentSum = payments.reduce((acc, p) => acc + p.amount, 0);
                                            const remaining = Math.max(0, totalWithDiscount - currentSum);
                                            setPayments([...payments, { method: 'PIX', amount: remaining }]);
                                        }}
                                    >
                                        <Plus className="h-3 w-3" /> Adicionar Outro Método
                                    </Button>
                                    <div className="flex justify-between items-center text-xs font-bold pt-2 border-t mt-2">
                                        <span>Total Pago: R$ {payments.reduce((acc, p) => acc + p.amount, 0).toFixed(2)}</span>
                                        <span className={Math.abs(payments.reduce((acc, p) => acc + p.amount, 0) - totalWithDiscount) < 0.01 ? "text-green-600" : "text-destructive"}>
                                            {payments.reduce((acc, p) => acc + p.amount, 0) < totalWithDiscount
                                                ? `Falta: R$ ${(totalWithDiscount - payments.reduce((acc, p) => acc + p.amount, 0)).toFixed(2)}`
                                                : payments.reduce((acc, p) => acc + p.amount, 0) > totalWithDiscount
                                                    ? `Excesso: R$ ${(payments.reduce((acc, p) => acc + p.amount, 0) - totalWithDiscount).toFixed(2)}`
                                                    : '✓ Valor Completo'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isMultiPayment && paymentMethod === 'Dinheiro' && (
                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="received" className="text-xs text-orange-800 font-bold">Valor Recebido (R$)</Label>
                                        <Input
                                            id="received"
                                            type="number"
                                            value={amountReceived}
                                            onChange={e => setAmountReceived(e.target.value)}
                                            placeholder="0.00"
                                            className="bg-white border-orange-300 focus-visible:ring-orange-500"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex flex-col justify-center items-end">
                                        <p className="text-[10px] text-orange-700 uppercase font-bold">Troco a devolver</p>
                                        <p className="text-2xl font-black text-orange-900">R$ {change.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCheckoutOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button
                            type="submit"
                            onClick={handleCheckout}
                            disabled={
                                isSubmitting ||
                                cart.length === 0 ||
                                (isMultiPayment && Math.abs(payments.reduce((acc, p) => acc + p.amount, 0) - totalWithDiscount) > 0.01)
                            }
                            className="gap-2"
                        >
                            {isSubmitting ? 'Processando...' : <><CheckCircle2 className="h-4 w-4" /> Concluir Venda [F9]</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <VisuallyHidden>
                            <DialogTitle>Venda Concluída</DialogTitle>
                        </VisuallyHidden>
                    </DialogHeader>
                    <div className="flex flex-col items-center text-center py-6">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold">Venda Concluída!</h2>
                        <p className="text-muted-foreground">O estoque foi atualizado e o pedido registrado.</p>
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/5 max-h-[300px] overflow-y-auto">
                        <div id="receipt-content">
                            <div className="center bold">DeliveryHub</div>
                            <div className="center">Cupom não fiscal</div>
                            <div className="divider"></div>
                            <div>Data: {new Date().toLocaleString('pt-BR')}</div>
                            <div>Pedido: {lastOrder?.id?.substring(0, 8).toUpperCase()}</div>
                            <div className="divider"></div>
                            <div className="bold">ITENS:</div>
                            {lastOrder?.orderItems?.map((item: any) => (
                                <div key={item.productId} className="item">
                                    <span>{item.quantity}x {item.productName}</span>
                                    <span>R$ {(item.finalPrice * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="divider"></div>
                            {lastOrder?.discount > 0 && (
                                <div className="item">
                                    <span>Subtotal</span>
                                    <span>R$ {lastOrder?.subtotal?.toFixed(2)}</span>
                                </div>
                            )}
                            {lastOrder?.discount > 0 && (
                                <div className="item">
                                    <span>Desconto</span>
                                    <span>- R$ {lastOrder?.discount?.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="total item">
                                <span>TOTAL</span>
                                <span>R$ {lastOrder?.totalAmount?.toFixed(2)}</span>
                            </div>
                            <div className="divider"></div>
                            <div className="bold">PAGAMENTO:</div>
                            <div>{lastOrder?.paymentMethod}</div>
                            {lastOrder?.paymentMethod === 'Dinheiro' && (
                                <>
                                    <div className="item">
                                        <span>Recebido</span>
                                        <span>R$ {lastOrder?.amountReceived?.toFixed(2)}</span>
                                    </div>
                                    <div className="item">
                                        <span>Troco</span>
                                        <span>R$ {lastOrder?.change?.toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <div className="divider"></div>
                            <div className="bold">CLIENTE:</div>
                            <div>{lastOrder?.customerName}</div>
                            {lastOrder?.customerPhone && <div>Tel: {lastOrder.customerPhone}</div>}
                            <div className="divider"></div>
                            <div className="center">Obrigado pela preferência!</div>
                            <div className="center" style={{ fontSize: '10px', marginTop: '10px', opacity: 0.7 }}>sistema criado por PC MANIA</div>
                            <div className="center" style={{ fontSize: '10px', opacity: 0.7 }}>www.pcmania.net</div>
                        </div>
                    </div>

                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button onClick={handlePrint} className="w-full gap-2 bg-black hover:bg-gray-800">
                            <Printer className="h-4 w-4" /> Imprimir Cupom
                        </Button>
                        <Button variant="outline" onClick={() => setIsSuccessOpen(false)} className="w-full">
                            Nova Venda
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Weight Entry Dialog */}
            <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Informar Peso</DialogTitle>
                        <DialogDescription>
                            Produto vendido por peso. Insira o peso em Kg (ex: 0.500 para 500g).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 flex flex-col items-center gap-4">
                        <div className="text-center">
                            <h3 className="text-lg font-bold">{selectedProductForWeight?.name}</h3>
                            <p className="text-primary font-semibold">R$ {selectedProductForWeight?.price.toFixed(2)} / kg</p>
                        </div>
                        <div className="w-full max-w-[200px] relative">
                            <Input
                                type="text"
                                className="text-4xl h-20 text-center font-black pr-12"
                                value={currentWeight}
                                onChange={e => setCurrentWeight(e.target.value)}
                                autoFocus
                                onKeyPress={e => e.key === 'Enter' && handleWeightConfirm()}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Kg</span>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground bg-muted/30 px-4 py-2 rounded-full">
                            Valor Estimado: <span className="text-foreground">R$ {((selectedProductForWeight?.price || 0) * (parseFloat(currentWeight.replace(',', '.')) || 0)).toFixed(2)}</span>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWeightDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleWeightConfirm} className="px-8">Confirmar Peso</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

