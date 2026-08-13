'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, User, Smartphone, CreditCard, DollarSign, Landmark, CheckCircle2, Printer, X, Package, Loader2, Scale } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { useImpersonation } from '@/context/impersonation-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { recordCashierSale } from '@/lib/finance-utils';
import { formatQuantity } from '@/lib/utils';

type VariantItem = {
    name: string;
    price: number;
};

type VariantGroup = {
    name: string;
    min: number;
    max: number;
    items: VariantItem[];
};

export type SelectedVariant = {
    groupName: string;
    itemName: string;
    price: number;
};

type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    stock: number;
    stockControlEnabled?: boolean;
    blockIfOutOfStock?: boolean;
    imageUrls: string[];
    isSoldByWeight?: boolean;
    variants?: VariantGroup[];
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
    selectedVariants?: SelectedVariant[];
    notes?: string;
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
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [isCanceling, setIsCanceling] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<any>(null);

    // Checkout State
    const [customerName, setCustomerName] = useState('Consumidor');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
    const [currentWeight, setCurrentWeight] = useState('1.000');
    const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);
    const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
    const [itemNotes, setItemNotes] = useState('');

    // Scale State (Web Serial API)
    const [isScaleConnected, setIsScaleConnected] = useState(false);
    const scalePortRef = useRef<any>(null);
    const scaleReaderRef = useRef<any>(null);
    const keepReadingRef = useRef<boolean>(true);

    const disconnectScale = async () => {
        keepReadingRef.current = false;
        try {
            if (scaleReaderRef.current) {
                await scaleReaderRef.current.cancel();
                scaleReaderRef.current = null;
            }
            if (scalePortRef.current) {
                await scalePortRef.current.close();
                scalePortRef.current = null;
            }
        } catch (e) {
            console.error(e);
        }
        setIsScaleConnected(false);
    };

    const readFromPort = async (port: any) => {
        try {
            await port.open({ baudRate: 9600 });
            scalePortRef.current = port;
            setIsScaleConnected(true);
            keepReadingRef.current = true;
            
            while (port.readable && keepReadingRef.current) {
                const reader = port.readable.getReader();
                scaleReaderRef.current = reader;
                try {
                    let buffer = '';
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        
                        buffer += new TextDecoder().decode(value);
                        // Filtra apenas números e pontuações válidas
                        const match = buffer.match(/\d+[.,]\d{3}/);
                        if (match) {
                            setCurrentWeight(match[0].replace(',', '.'));
                            buffer = ''; // Limpa o buffer após achar um peso
                        }
                        if (buffer.length > 50) buffer = buffer.substring(buffer.length - 20); // Impede o buffer de crescer infinitamente
                    }
                } catch (error) {
                    console.error("Erro na leitura serial:", error);
                } finally {
                    reader.releaseLock();
                }
            }
        } catch (err) {
            console.error("Erro ao conectar/ler da porta serial:", err);
        }
    };

    const autoConnectScale = async () => {
        if (!('serial' in navigator)) return;
        try {
            // getPorts() retorna as portas que o usuário JÁ deu permissão no passado.
            // Não exibe popup e pode rodar no carregamento da página.
            const ports = await (navigator as any).serial.getPorts();
            if (ports && ports.length > 0) {
                // Tenta conectar automaticamente na primeira porta salva (a da balança)
                readFromPort(ports[0]);
            }
        } catch (err) {
            console.error("Erro no auto-connect da balança:", err);
        }
    };

    const connectScale = async () => {
        if (!('serial' in navigator)) {
            toast({ variant: 'destructive', title: 'Navegador não suportado', description: 'A leitura direta da balança não é suportada no seu navegador. Use Chrome ou Edge no computador.' });
            return;
        }
        try {
            // requestPort() DEVE ser chamado por um clique do usuário (popup de permissão)
            const port = await (navigator as any).serial.requestPort();
            toast({ title: 'Balança Conectada e Salva!' });
            readFromPort(port);
        } catch (err) {
            console.error("Erro ao solicitar porta serial:", err);
        }
    };

    useEffect(() => {
        autoConnectScale();
        return () => {
            disconnectScale();
        };
    }, []);

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
    const openOptionsDialog = (product: Product) => {
        setSelectedProductForOptions(product);
        setSelectedVariants([]);
        setItemNotes('');
        setCurrentWeight('1.000');
        setIsOptionsDialogOpen(true);
    };

    const addToCart = (product: Product, weight?: number, variants: SelectedVariant[] = [], notes: string = '') => {
        if (product.stockControlEnabled && product.blockIfOutOfStock !== false && (product.stock || 0) <= 0) {
            toast({
                variant: 'destructive',
                title: 'Produto Esgotado',
                description: 'Este produto está sem estoque e o bloqueio de vendas está ativado.'
            });
            return;
        }

        const needsOptions = (product.variants && product.variants.length > 0) || product.isSoldByWeight;
        const isBypassingOptions = weight !== undefined || variants.length > 0 || notes !== '';

        if (needsOptions && !isBypassingOptions) {
            openOptionsDialog(product);
            return;
        }

        const qtyToAdd = weight !== undefined ? weight : 1;
        const optionsPrice = variants.reduce((sum, v) => sum + v.price, 0);
        const finalPrice = product.price + optionsPrice;

        setCart(prev => {
            const hasOptions = variants.length > 0 || notes.trim() !== '';
            const existing = prev.find(item => 
                item.product.id === product.id && 
                !product.isSoldByWeight &&
                !hasOptions &&
                (!item.selectedVariants || item.selectedVariants.length === 0) &&
                (!item.notes)
            );
            
            if (existing && !product.isSoldByWeight && !hasOptions) {
                return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + qtyToAdd } : item);
            }
            return [...prev, { 
                id: `${product.id}-${Date.now()}`, 
                product, 
                quantity: qtyToAdd, 
                finalPrice: finalPrice,
                selectedVariants: variants,
                notes
            }];
        });
    };

    const handleOptionsSelection = (groupName: string, itemName: string, price: number, isSingleChoice: boolean) => {
        const group = selectedProductForOptions?.variants?.find(v => v.name === groupName);
        if (!group) return;
        const isCurrentlySelected = selectedVariants.some(v => v.groupName === groupName && v.itemName === itemName);
        const groupItemsSelectedCount = selectedVariants.filter(v => v.groupName === groupName).length;
        if (isSingleChoice) {
            setSelectedVariants(prev => [...prev.filter(v => v.groupName !== groupName), { groupName, itemName, price }]);
        } else {
            if (isCurrentlySelected) {
                setSelectedVariants(prev => prev.filter(v => !(v.groupName === groupName && v.itemName === itemName)));
            } else {
                if (groupItemsSelectedCount >= group.max) {
                    toast({ variant: 'destructive', title: 'Limite atingido', description: `Máximo de ${group.max} opção(ões) para "${groupName}".` });
                } else {
                    setSelectedVariants(prev => [...prev, { groupName, itemName, price }]);
                }
            }
        }
    };

    const handleOptionsConfirm = () => {
        if (!selectedProductForOptions) return;

        for (const group of selectedProductForOptions.variants || []) {
            const selectedCount = selectedVariants.filter(v => v.groupName === group.name).length;
            if (selectedCount < group.min) {
                toast({ variant: 'destructive', title: 'Seleção Incompleta', description: `Selecione pelo menos ${group.min} opção(ões) para "${group.name}".` });
                return;
            }
        }

        let weightToPass = undefined;
        if (selectedProductForOptions.isSoldByWeight) {
            weightToPass = parseFloat(currentWeight.replace(',', '.'));
            if (isNaN(weightToPass) || weightToPass <= 0) {
                toast({ variant: 'destructive', title: 'Peso inválido' });
                return;
            }
        }

        addToCart(selectedProductForOptions, weightToPass, selectedVariants, itemNotes);
        setIsOptionsDialogOpen(false);
        setSelectedProductForOptions(null);
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
                if (isOptionsDialogOpen) setIsOptionsDialogOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCheckoutOpen, cart.length, isSuccessOpen, isOptionsDialogOpen, customerName, customerPhone, paymentMethod, discount, amountReceived, isMultiPayment, payments]);

    const handleCheckout = async () => {
        if (!firestore || !user || cart.length === 0) return;

        // Check for out of stock items with blocking enabled (using fresh productsData)
        const blockedItems = cart.filter(item => {
            const freshProduct = productsData?.find(p => p.id === item.product.id);
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

        // Validation for Crediário
        const hasCrediario = isMultiPayment ? payments.some(p => p.method === 'Crediário') : paymentMethod === 'Crediário';
        if (hasCrediario) {
            if (!customerName || customerName.trim() === 'Consumidor') {
                toast({ variant: 'destructive', title: 'Nome Obrigatório', description: 'Para vendas no crediário, informe o nome do cliente.' });
                setIsSubmitting(false);
                return;
            }
            if (!customerAddress || customerAddress.trim() === '') {
                toast({ variant: 'destructive', title: 'Endereço Obrigatório', description: 'Para vendas no crediário, informe o endereço do cliente.' });
                setIsSubmitting(false);
                return;
            }
        }

        try {
            const ordersRef = collection(firestore, 'companies', effectiveCompanyId as string, 'orders');

            const fullPaymentMethod = isMultiPayment
                ? payments.map(p => {
                    if (p.method === 'Dinheiro' && p.received && p.received > p.amount) {
                        return `${p.method}: R$ ${p.amount.toFixed(2)} (Rec: R$ ${p.received.toFixed(2)}, Troco: R$ ${(p.received - p.amount).toFixed(2)})`;
                    }
                    return `${p.method}: R$ ${p.amount.toFixed(2)}`;
                }).join(' | ')
                : (paymentMethod === 'Dinheiro' && amountReceived ? `Dinheiro (Troco para R$ ${parseFloat(amountReceived).toFixed(2)})` : paymentMethod);

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
                orderItems: cart.map(item => {
                    let combinedNotes = item.notes || '';
                    if (item.selectedVariants && item.selectedVariants.length > 0) {
                        const variantsText = item.selectedVariants.map(v => `${v.itemName}`).join(', ');
                        combinedNotes = combinedNotes ? `${variantsText} | Obs: ${combinedNotes}` : variantsText;
                    }
                    return {
                        productId: item.product.id,
                        productName: item.product.name,
                        quantity: item.quantity,
                        unitPrice: item.product.price,
                        finalPrice: item.finalPrice,
                        notes: combinedNotes,
                        isSoldByWeight: item.product.isSoldByWeight ?? false,
                        selectedVariants: item.selectedVariants || [],
                    };
                }),
                totalAmount: totalWithDiscount,
                subtotal: total,
                origin: 'PDV',
                amountReceived: isMultiPayment ? (payments.find(p => p.method === 'Dinheiro')?.received || 0) : parseFloat(amountReceived || '0'),
                change: isMultiPayment
                    ? payments.reduce((acc, p) => acc + (p.method === 'Dinheiro' && p.received ? Math.max(0, p.received - p.amount) : 0), 0)
                    : change,
                payments: isMultiPayment ? payments : [{ method: paymentMethod, amount: totalWithDiscount, received: parseFloat(amountReceived || '0') }]
            };

            const docRef = await addDocument(ordersRef, orderData);

            // Handle Crediário Generation
            if (hasCrediario) {
                const crediarioAmount = isMultiPayment 
                    ? payments.filter(p => p.method === 'Crediário').reduce((acc, p) => acc + p.amount, 0)
                    : totalWithDiscount;

                const receivablesRef = collection(firestore, 'companies', effectiveCompanyId as string, 'receivables');
                await addDocument(receivablesRef, {
                    companyId: effectiveCompanyId,
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    customerAddress: customerAddress.trim(),
                    customerEmail: customerEmail.trim(),
                    originalAmount: crediarioAmount,
                    remainingAmount: crediarioAmount,
                    status: 'pendente',
                    dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Vence em 1 mês por padrão
                    createdAt: serverTimestamp(),
                    originOrderId: docRef.id,
                    notes: 'Venda via PDV'
                });
            }

            try {
                if (isMultiPayment && payments.length > 0) {
                    // Para pagamentos múltiplos, registra uma transação para cada método
                    for (const p of payments) {
                        if (p.method === 'Crediário') continue; // Não entra no caixa agora
                        const result = await recordCashierSale(
                            firestore,
                            effectiveCompanyId as string,
                            p.amount,
                            `Venda de Balcão #${docRef.id.substring(0, 6).toUpperCase()} (${p.method})`,
                            docRef.id,
                            p.method
                        );

                        if (result && result.success && result.sessionId) {
                            const orderRef = doc(firestore, 'companies', effectiveCompanyId as string, 'orders', docRef.id);
                            await updateDocument(orderRef, { sessionId: result.sessionId });
                        }
                    }
                } else {
                    if (paymentMethod !== 'Crediário') {
                        // Pagamento único
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
                                const orderRef = doc(firestore, 'companies', effectiveCompanyId as string, 'orders', docRef.id);
                                await updateDocument(orderRef, { sessionId: result.sessionId });
                            }
                        } else {
                            console.warn('Venda não vinculada ao caixa (caixa pode estar fechado)');
                            toast({
                                variant: 'destructive',
                                title: "Aviso de Caixa",
                                description: "A venda foi salva, mas não foi possível vincular ao caixa (verifique se há um caixa aberto)."
                            });
                        }
                    }
                }
            } catch (cashierError) {
                console.error('Erro ao vincular venda ao caixa:', cashierError);
                toast({
                    variant: 'destructive',
                    title: "Erro no Caixa",
                    description: "A venda foi salva, mas houve um erro ao registrar no caixa."
                });
            }

            // Stock Decrement - Direct Update (Admin has permission)
            const stockItems = cart
                .filter(item => item.product.stockControlEnabled)
                .map(item => ({ productId: item.product.id, quantity: item.quantity }));

            if (stockItems.length > 0) {
                try {
                    await Promise.all(stockItems.map(item => {
                        const productRef = doc(firestore, 'companies', user.uid, 'products', item.productId);
                        return updateDocument(productRef, { stock: increment(-item.quantity) });
                    }));
                } catch (stockError) {
                    console.error('Falha ao baixar estoque direto:', stockError);
                    toast({
                        variant: 'destructive',
                        title: "Aviso de Estoque",
                        description: "A venda foi salva, mas houve um erro ao atualizar o estoque."
                    });
                }
            }

            setLastOrder({ ...orderData, id: docRef.id, originalCartForRefund: cart, hasCrediario });
            setCart([]);
            setIsCheckoutOpen(false);
            setIsSuccessOpen(true);
            setCustomerName('Consumidor');
            setCustomerPhone('');
            setCustomerAddress('');
            setCustomerEmail('');
            setPaymentMethod('Dinheiro');
            setDiscount('0.00');
            setAmountReceived('');
            setIsMultiPayment(false);
            setPayments([]);
            setSearchQuery('');
            setSelectedCategory(null);

            toast({ title: "Venda Finalizada!", description: "O pedido foi registrado com sucesso." });
        } catch (e) {
            console.error('Erro detalhado ao finalizar venda:', e);
            toast({ variant: 'destructive', title: "Erro ao finalizar venda", description: e instanceof Error ? e.message : "Tente novamente ou contate o suporte." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchRecentOrders = async () => {
        if (!firestore || !effectiveCompanyId) return;
        setIsLoadingHistory(true);
        try {
            const ordersRef = collection(firestore, `companies/${effectiveCompanyId}/orders`);
            const q = query(
                ordersRef,
                where('origin', '==', 'PDV'),
                limit(10)
            );
            const snap = await getDocs(q);
            const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            orders.sort((a: any, b: any) => {
                const dateA = a.orderDate?.toMillis?.() || 0;
                const dateB = b.orderDate?.toMillis?.() || 0;
                return dateB - dateA;
            });

            setRecentOrders(orders);
        } catch (e) {
            console.error('Erro ao buscar histórico:', e);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível buscar as vendas recentes.' });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleCancelSale = async () => {
        const order = orderToCancel || lastOrder;
        if (!firestore || !user || !order) return;
        setIsCanceling(true);

        try {
            const orderDocRef = doc(firestore, `companies/${effectiveCompanyId}/orders`, order.id);
            await updateDocument(orderDocRef, { status: 'Cancelado' });

            // 1. Estorno de Estoque
            // Usa o carrinho original se for a última venda, senão avalia os itens salvos buscando no productsData
            const itemsToRefund = order.originalCartForRefund 
                ? order.originalCartForRefund 
                : order.orderItems?.map((item: any) => {
                    const productDef = productsData?.find(p => p.id === item.productId);
                    return {
                        product: {
                            id: item.productId,
                            stockControlEnabled: productDef?.stockControlEnabled || false,
                        },
                        quantity: item.quantity
                    };
                }) || [];

            const stockItems = itemsToRefund
                .filter((item: any) => item.product?.stockControlEnabled)
                .map((item: any) => ({ productId: item.product.id, quantity: item.quantity }));

            if (stockItems.length > 0) {
                await Promise.all(stockItems.map((item: any) => {
                    const productRef = doc(firestore, 'companies', effectiveCompanyId as string, 'products', item.productId);
                    return updateDocument(productRef, { stock: increment(item.quantity) });
                }));
            }

            // 2. Extorno de Caixa
            // Verifica se a venda teve pagamentos pelo array payments ou pelo paymentMethod direto
            const paymentsToRefund = order.payments || (order.paymentMethod ? [{ method: order.paymentMethod, amount: order.totalAmount }] : []);

            if (paymentsToRefund.length > 0) {
                for (const p of paymentsToRefund) {
                    if (p.method === 'Crediário') continue; 
                    await recordCashierSale(
                        firestore,
                        effectiveCompanyId as string,
                        p.amount,
                        `Extorno Venda #${order.id.substring(0, 6).toUpperCase()} (${p.method})`,
                        order.id,
                        p.method,
                        'withdrawal'
                    );
                }
            }

            // 3. Cancelar Crediário
            const isCrediario = order.hasCrediario || paymentsToRefund.some((p: any) => p.method === 'Crediário');
            if (isCrediario) {
                const receivablesRef = collection(firestore, `companies/${effectiveCompanyId}/receivables`);
                const q = query(receivablesRef, where('originOrderId', '==', order.id), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const receivableDoc = snap.docs[0];
                    const recRef = doc(firestore, `companies/${effectiveCompanyId}/receivables`, receivableDoc.id);
                    await updateDocument(recRef, { status: 'cancelado' });
                }
            }

            toast({ title: 'Venda Cancelada', description: 'O estoque foi reposto e o valor estornado no caixa.' });
            setIsCancelDialogOpen(false);
            setIsSuccessOpen(false); 
            setOrderToCancel(null);
            
            // Atualiza histórico se estiver aberto
            if (isHistoryOpen) {
                fetchRecentOrders();
            }
        } catch (error) {
            console.error('Erro ao cancelar venda:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Houve um erro ao cancelar a venda.' });
        } finally {
            setIsCanceling(false);
        }
    };

    useEffect(() => {
        if (isHistoryOpen) {
            fetchRecentOrders();
        }
    }, [isHistoryOpen]);

    const handlePrint = (orderToPrint?: any) => {
        const order = orderToPrint || lastOrder;
        if (!order) return;

        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        if (printWindow) {
            const dateStr = order.orderDate?.toDate ? order.orderDate.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
            const itemsHtml = order.orderItems?.map((item: any) => `
                <div class="item">
                    <span>${formatQuantity(item.quantity, item.isSoldByWeight)} ${item.productName}</span>
                    <span>R$ ${(item.finalPrice * item.quantity).toFixed(2)}</span>
                </div>
                ${item.notes ? `<div style="font-size: 10px; color: #555; padding-left: 10px; margin-bottom: 4px;">${item.notes}</div>` : ''}
            `).join('') || '';

            const subtotalHtml = order.discount > 0 ? `
                <div class="item">
                    <span>Subtotal</span>
                    <span>R$ ${order.subtotal?.toFixed(2)}</span>
                </div>
                <div class="item">
                    <span>Desconto</span>
                    <span>- R$ ${order.discount?.toFixed(2)}</span>
                </div>
            ` : '';

            const changeHtml = (order.amountReceived > 0 && order.change >= 0) ? `
                <div class="item">
                    <span>Recebido</span>
                    <span>R$ ${order.amountReceived?.toFixed(2)}</span>
                </div>
                <div class="item">
                    <span>Troco</span>
                    <span>R$ ${order.change?.toFixed(2)}</span>
                </div>
            ` : '';

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
                        <div class="center bold">DeliveryHub</div>
                        <div class="center">Cupom não fiscal</div>
                        <div class="divider"></div>
                        <div>Data: ${dateStr}</div>
                        <div>Pedido: ${order.id?.substring(0, 8).toUpperCase()}</div>
                        <div class="divider"></div>
                        <div class="bold">ITENS:</div>
                        ${itemsHtml}
                        <div class="divider"></div>
                        ${subtotalHtml}
                        <div class="total item">
                            <span>TOTAL</span>
                            <span>R$ ${order.totalAmount?.toFixed(2)}</span>
                        </div>
                        <div class="divider"></div>
                        <div class="bold">PAGAMENTO:</div>
                        <div>${order.paymentMethod}</div>
                        ${changeHtml}
                        <div class="divider"></div>
                        <div class="bold">CLIENTE:</div>
                        <div>${order.customerName}</div>
                        ${order.customerPhone ? `<div>Tel: ${order.customerPhone}</div>` : ''}
                        <div class="divider"></div>
                        <div class="center">Obrigado pela preferência!</div>
                        <div class="center" style="font-size: 10px; margin-top: 10px; opacity: 0.7;">sistema criado por PC MANIA</div>
                        <div class="center" style="font-size: 10px; opacity: 0.7;">www.pcmania.net</div>
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
                                className="group relative flex flex-col border rounded-lg p-2 sm:p-3 cursor-pointer hover:border-primary transition-all hover:bg-primary/5 active:scale-95 bg-card shadow-sm"
                            >
                                <div className="relative aspect-video w-full mb-2 sm:mb-3 rounded-md overflow-hidden bg-muted">
                                    {product.imageUrls?.[0] ? (
                                        <Image
                                            src={product.imageUrls[0]}
                                            alt={product.name}
                                            fill
                                            className={`object-cover group-hover:scale-110 transition-transform \${product.stockControlEnabled && product.blockIfOutOfStock !== false && (Number(product.stock) || 0) <= 0 ? 'grayscale opacity-30' : ''}`}
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <Package className="h-6 w-6 sm:h-8 sm:w-8 opacity-20" />
                                        </div>
                                    )}
                                    {product.stockControlEnabled && product.blockIfOutOfStock !== false && (Number(product.stock) || 0) <= 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 border-4 border-destructive animate-pulse">
                                            <span className="text-white font-black text-xs sm:text-base uppercase tracking-widest -rotate-12 border-2 border-white px-2 py-1">ESGOTADO</span>
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
                                        
                                        {item.selectedVariants && item.selectedVariants.length > 0 && (
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                {item.selectedVariants.map((v, idx) => (
                                                    <span key={idx} className="block">• {v.itemName} {v.price > 0 ? `(+R$ ${v.price.toFixed(2)})` : ''}</span>
                                                ))}
                                            </div>
                                        )}
                                        {item.notes && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5 italic">Obs: {item.notes}</p>
                                        )}

                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                            {item.product.isSoldByWeight
                                                ? `${formatQuantity(item.quantity, true)} x R$ ${item.product.price.toFixed(2).replace('.', ',')}`
                                                : `R$ ${item.finalPrice.toFixed(2).replace('.', ',')} x ${item.quantity}`}
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
                                                    openOptionsDialog(item.product);
                                                    setCurrentWeight(item.quantity.toFixed(3));
                                                    setSelectedVariants(item.selectedVariants || []);
                                                    setItemNotes(item.notes || '');
                                                    removeFromCart(item.id);
                                                }}>
                                                    Editar
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
                <Button variant="outline" size="sm" className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5" onClick={() => setIsHistoryOpen(true)}>
                    <Printer className="h-4 w-4 text-primary" /> Reimprimir Cupom
                </Button>
            </div>

            {/* Content for both Mobile (Tabs) and Desktop (Side-by-side) */}
            {/* We define them once for clean code, or use them conditionally */}

            <Tabs defaultValue="products" className="flex-1 flex flex-col overflow-hidden xl:hidden">
                <TabsList className="flex flex-wrap w-full justify-start h-auto mb-2">
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

                <TabsContent value="products" className="data-[state=active]:flex-1 data-[state=active]:flex flex-col overflow-hidden m-0">
                    {renderProductSection()}
                </TabsContent>

                <TabsContent value="cart" className="data-[state=active]:flex-1 data-[state=active]:flex flex-col overflow-hidden m-0">
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
                                        className={paymentMethod === 'Crediário' && !customerName ? 'border-destructive' : ''}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cust-phone" className="text-xs text-muted-foreground">WhatsApp</Label>
                                    <Input id="cust-phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(99) 99999-9999" />
                                </div>
                                {(paymentMethod === 'Crediário' || payments.some(p => p.method === 'Crediário')) && (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="cust-address" className="text-xs text-muted-foreground">Endereço (Obrigatório para Crediário)</Label>
                                            <Input id="cust-address" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Rua, Número, Bairro" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cust-email" className="text-xs text-muted-foreground">E-mail</Label>
                                            <Input id="cust-email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="cliente@email.com" />
                                        </div>
                                    </>
                                )}
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
                                    <div>
                                        <RadioGroupItem value="Crediário" id="crediario" className="peer sr-only" />
                                        <Label
                                            htmlFor="crediario"
                                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                                        >
                                            <User className="mb-2 h-5 w-5" />
                                            <span className="text-xs">Crediário</span>
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
                                                    <option value="Crediário">Crediário/Fiado</option>
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
                            <DialogDescription>A venda foi processada com sucesso e o cupom está pronto para impressão.</DialogDescription>
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
                                <div key={item.productId} className="mb-2">
                                    <div className="item">
                                        <span>{formatQuantity(item.quantity, item.isSoldByWeight)} {item.productName}</span>
                                        <span>R$ {(item.finalPrice * item.quantity).toFixed(2)}</span>
                                    </div>
                                    {item.notes && (
                                        <div className="text-[10px] text-muted-foreground pl-2 leading-tight text-left">
                                            {item.notes}
                                        </div>
                                    )}
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
                        <div className="flex w-full gap-2">
                            <Button onClick={handlePrint} className="flex-1 gap-2 bg-black hover:bg-gray-800">
                                <Printer className="h-4 w-4" /> Imprimir Cupom
                            </Button>
                            <Button variant="destructive" onClick={() => { setOrderToCancel(null); setIsCancelDialogOpen(true); }} className="flex-1 gap-2" title="Cancelar Venda">
                                <Trash2 className="h-4 w-4" /> Cancelar Venda
                            </Button>
                        </div>
                        <Button variant="outline" onClick={() => setIsSuccessOpen(false)} className="w-full">
                            Nova Venda
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Options Entry Dialog */}
            <Dialog open={isOptionsDialogOpen} onOpenChange={setIsOptionsDialogOpen}>
                <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-5 pt-5 pb-2">
                        <DialogTitle>{selectedProductForOptions?.name}</DialogTitle>
                        <DialogDescription>
                            {selectedProductForOptions?.isSoldByWeight ? 'Produto vendido por peso.' : 'Selecione as opções do produto.'}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="flex-1 px-5">
                        <div className="py-2 flex flex-col gap-6">
                            {/* Variants Section */}
                            {selectedProductForOptions?.variants?.map(group => {
                                const isSingleChoice = group.max === 1 && group.min === 1;
                                return (
                                    <div key={group.name} className="space-y-2">
                                        <Separator className="mb-4" />
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold">{group.name}</h4>
                                            {group.min > 0 && <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">Obrigatório</span>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {group.min > 0 && group.max > group.min
                                                ? `Selecione de ${group.min} a ${group.max} opções`
                                                : group.min > 0 && group.max === group.min
                                                ? `Selecione ${group.min} ${group.min > 1 ? 'opções' : 'opção'}`
                                                : `Selecione até ${group.max} ${group.max > 1 ? 'opções' : 'opção'}`}
                                        </p>
                                        
                                        {isSingleChoice ? (
                                            <RadioGroup 
                                                value={selectedVariants.find(v => v.groupName === group.name)?.itemName ? `${selectedVariants.find(v => v.groupName === group.name)?.itemName};${selectedVariants.find(v => v.groupName === group.name)?.price}` : undefined}
                                                onValueChange={(value) => handleOptionsSelection(group.name, value.split(';')[0], parseFloat(value.split(';')[1]), true)}
                                            >
                                                {group.items.map(item => (
                                                    <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <RadioGroupItem value={`${item.name};${item.price}`} id={`${group.name}-${item.name}`} />
                                                            <Label htmlFor={`${group.name}-${item.name}`} className="cursor-pointer font-normal">{item.name}</Label>
                                                        </div>
                                                        {item.price > 0 && <span className="text-sm font-medium text-primary">+ R$ {item.price.toFixed(2)}</span>}
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        ) : (
                                            <div className="space-y-2">
                                                {group.items.map(item => (
                                                    <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`${group.name}-${item.name}`}
                                                                checked={selectedVariants.some(v => v.groupName === group.name && v.itemName === item.name)}
                                                                onCheckedChange={() => handleOptionsSelection(group.name, item.name, item.price, false)}
                                                            />
                                                            <Label htmlFor={`${group.name}-${item.name}`} className="cursor-pointer font-normal">{item.name}</Label>
                                                        </div>
                                                        {item.price > 0 && <span className="text-sm font-medium text-primary">+ R$ {item.price.toFixed(2)}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Weight Section */}
                            {selectedProductForOptions?.isSoldByWeight && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-primary font-bold">Informar Peso (Kg)</Label>
                                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">Obrigatório</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-4 bg-muted/30 p-4 rounded-xl">
                                        {!isScaleConnected ? (
                                            <Button 
                                                variant="outline" 
                                                className="w-full max-w-[200px] border-dashed border-primary/50 text-primary hover:bg-primary/5"
                                                onClick={connectScale}
                                            >
                                                🔌 Conectar Balança
                                            </Button>
                                        ) : (
                                            <div className="w-full max-w-[200px] flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-2 rounded-lg font-semibold animate-pulse border border-emerald-500/20">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Lendo Balança...
                                            </div>
                                        )}
                                        <div className="w-full max-w-[200px] relative">
                                            <Input
                                                type="text"
                                                className={`text-4xl h-20 text-center font-black pr-12 transition-all ${isScaleConnected ? 'bg-emerald-50 border-emerald-200 focus-visible:ring-emerald-500' : ''}`}
                                                value={currentWeight}
                                                onChange={e => setCurrentWeight(e.target.value)}
                                                autoFocus={!isScaleConnected}
                                                readOnly={isScaleConnected}
                                                onKeyPress={e => e.key === 'Enter' && handleOptionsConfirm()}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Kg</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notes Section */}
                            <div className="space-y-2 pb-6 pt-4 border-t">
                                <Label htmlFor="notes" className="font-semibold">Observações (Opcional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Ex: sem cebola..."
                                    value={itemNotes}
                                    onChange={(e) => setItemNotes(e.target.value)}
                                    className="resize-none bg-muted/30"
                                    rows={2}
                                />
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="p-5 border-t bg-background">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm text-muted-foreground font-medium">Total Estimado</span>
                            <span className="text-xl font-bold text-primary">
                                R$ {((selectedProductForOptions?.price || 0) + selectedVariants.reduce((sum, v) => sum + v.price, 0)).toFixed(2)}
                                {selectedProductForOptions?.isSoldByWeight ? ' / kg' : ''}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsOptionsDialogOpen(false)}>Cancelar</Button>
                            <Button className="flex-[2]" onClick={handleOptionsConfirm}>Confirmar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History / Reprint Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5" /> Vendas Recentes para Reimpressão
                        </DialogTitle>
                        <DialogDescription>
                            Visualize as últimas vendas realizadas e reimprima o cupom se necessário.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 mt-4">
                        {isLoadingHistory ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : recentOrders.length > 0 ? (
                            <div className="space-y-3">
                                {recentOrders.map((order) => (
                                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm ${order.status === 'Cancelado' ? 'line-through text-muted-foreground' : ''}`}>#{order.id.substring(0, 8).toUpperCase()}</span>
                                                {order.status === 'Cancelado' && <Badge variant="destructive" className="text-[10px] h-4 px-1 py-0">Cancelada</Badge>}
                                                <Badge variant="outline" className="text-[10px]">{order.orderDate?.toDate ? order.orderDate.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sem data'}</Badge>
                                            </div>
                                            <p className={`text-xs mt-1 ${order.status === 'Cancelado' ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                                <span className={`font-medium ${order.status === 'Cancelado' ? '' : 'text-foreground'}`}>{order.customerName}</span> • 
                                                R$ {order.totalAmount.toFixed(2)} • {order.paymentMethod?.split('|')[0] || order.paymentMethod}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" onClick={() => handlePrint(order)} className="h-9 w-9" title="Imprimir Cupom">
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            {order.status !== 'Cancelado' && (
                                                <Button variant="outline" size="icon" className="h-9 w-9 text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => { setOrderToCancel(order); setIsCancelDialogOpen(true); }} title="Cancelar Venda">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>Nenhuma venda recente encontrada.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={isCancelDialogOpen} onOpenChange={(open) => { setIsCancelDialogOpen(open); if (!open) setOrderToCancel(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Cancelar Venda</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja cancelar a venda #{(orderToCancel?.id || lastOrder?.id)?.substring(0, 8).toUpperCase()}? O estoque será reposto e o valor será estornado do caixa se aplicável. Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} disabled={isCanceling}>Voltar</Button>
                        <Button variant="destructive" onClick={handleCancelSale} disabled={isCanceling}>
                            {isCanceling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            Confirmar Cancelamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
