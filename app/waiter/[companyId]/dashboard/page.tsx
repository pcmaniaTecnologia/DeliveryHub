'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, type Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, PlusCircle, Receipt, ShoppingBag, LogOut, Search, Ticket, Printer, Plus, Minus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateTokenPrintHtml, printHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';

type OrderItem = {
    productName?: string;
    quantity: number;
    unitPrice: number;
    finalPrice?: number;
    selectedVariants?: { itemName: string }[];
};

type Order = {
    id: string;
    orderDate: Timestamp;
    status: string;
    deliveryType: string;
    tableNumber?: string;
    orderItems: OrderItem[];
    totalAmount: number;
};

export default function WaiterDashboardPage() {
    const params = useParams();
    const companyId = params?.companyId as string;
    const router = useRouter();
    const firestore = useFirestore();

    const [waiterName, setWaiterName] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const [nameInput, setNameInput] = useState('');
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    // Vender Ficha states
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [tokenProductSearch, setTokenProductSearch] = useState('');
    const [tokenSelectedProduct, setTokenSelectedProduct] = useState<{id: string, name: string, price: number} | null>(null);
    const [tokenCustomerName, setTokenCustomerName] = useState('');
    const [tokenQuantity, setTokenQuantity] = useState(1);
    const [tokenPaymentMethod, setTokenPaymentMethod] = useState('');
    const [isProcessingToken, setIsProcessingToken] = useState(false);
    const [isTokenSearchOpen, setIsTokenSearchOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(`waiter_name_${companyId}`);
        if (saved) {
            setWaiterName(saved);
        } else {
            router.replace(`/waiter/${companyId}`);
        }
        setIsChecking(false);
    }, [companyId, router]);

    const handleSetName = () => {
        if (!nameInput.trim()) return;
        localStorage.setItem(`waiter_name_${companyId}`, nameInput);
        setWaiterName(nameInput);
    };

    const handleLogoutName = () => {
        localStorage.removeItem(`waiter_name_${companyId}`);
        setWaiterName(null);
        setNameInput('');
        router.replace(`/waiter/${companyId}`);
    };

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return doc(firestore, 'companies', companyId);
    }, [firestore, companyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc<{ numberOfTables?: number, name?: string, paymentMethods?: { cash?: boolean, pix?: boolean, credit?: boolean, debit?: boolean } }>(companyRef);

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return collection(firestore, `companies/${companyId}/orders`);
    }, [firestore, companyId]);

    const { data: allOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);

    const productsRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return collection(firestore, `companies/${companyId}/products`);
    }, [firestore, companyId]);

    const { data: allProducts } = useCollection<{ id: string; name: string; price: number }>(productsRef);

    const handleTokenProductSearchChange = (val: string) => {
        setTokenProductSearch(val);
        setTokenSelectedProduct(null);
        setIsTokenSearchOpen(true);
    };

    const handleSelectTokenProduct = (product: { id: string; name: string; price: number }) => {
        setTokenSelectedProduct(product);
        setTokenProductSearch(product.name);
        setIsTokenSearchOpen(false);
    };

    const handleSellToken = async () => {
        if (!firestore || !tokenSelectedProduct || tokenQuantity <= 0 || !tokenPaymentMethod) {
            toast({ variant: 'destructive', title: 'Selecione um produto, quantidade e forma de pagamento.' });
            return;
        }
        setIsProcessingToken(true);
        try {
            const price = tokenSelectedProduct.price;
            const orderTotal = price * tokenQuantity;
            const ordersCollRef = collection(firestore, `companies/${companyId}/orders`);
            const clientName = tokenCustomerName.trim();
            const finalCustomerName = clientName || `Ficha - ${waiterName || 'Garçom'}`;
            await addDoc(ordersCollRef, {
                companyId,
                customerId: 'balcao_system',
                customerName: finalCustomerName,
                waiterName: waiterName || 'Garçom',
                orderDate: serverTimestamp(),
                status: 'Entregue',
                deliveryType: 'Balcão',
                deliveryFee: 0,
                discount: 0,
                subtotal: orderTotal,
                totalAmount: orderTotal,
                notes: 'Venda de Ficha Rápida',
                paymentMethod: `${tokenPaymentMethod}: R$ ${orderTotal.toFixed(2)}`,
                payments: [{ method: tokenPaymentMethod, amount: orderTotal }],
                orderItems: [{
                    productId: tokenSelectedProduct.id,
                    productName: tokenSelectedProduct.name,
                    quantity: tokenQuantity,
                    unitPrice: price,
                    finalPrice: price,
                    isSoldByWeight: false
                }]
            });
            toast({ title: 'Fichas vendidas com sucesso!' });
            const printHtmlContent = generateTokenPrintHtml(tokenQuantity, tokenSelectedProduct.name, price, companyData?.name, tokenPaymentMethod, clientName || undefined);
            
            // Fechar modal primeiro e limpar campos para evitar travamento da interface
            setIsTokenModalOpen(false);
            setTokenProductSearch('');
            setTokenSelectedProduct(null);
            setTokenCustomerName('');
            setTokenQuantity(1);
            setTokenPaymentMethod('');
            setIsTokenSearchOpen(false);

            if (typeof document !== 'undefined') {
                document.body.style.pointerEvents = 'auto';
            }

            // Executa a impressão via iframe de forma segura
            setTimeout(() => {
                printHtml(printHtmlContent);
                if (typeof document !== 'undefined') {
                    document.body.style.pointerEvents = 'auto';
                }
            }, 150);
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Erro ao vender ficha' });
        } finally {
            setIsProcessingToken(false);
            if (typeof document !== 'undefined') {
                document.body.style.pointerEvents = 'auto';
            }
        }
    };

    const tableStates = useMemo(() => {
        if (!allOrders || !companyData) return {};
        
        const activeOrders = allOrders.filter(
            o => (o.deliveryType === 'Mesa' || o.tableNumber) && o.status !== 'Entregue' && o.status !== 'Cancelado'
        );

        return activeOrders.reduce((acc, order) => {
            const table = order.tableNumber || '0';
            if (!acc[table]) {
                acc[table] = { orders: [], total: 0 };
            }
            acc[table].orders.push(order);
            acc[table].total += order.totalAmount;
            return acc;
        }, {} as Record<string, { orders: any[], total: number }>);
    }, [allOrders, companyData]);

    if (isLoadingCompany || isLoadingOrders || isChecking) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!waiterName) {
        return null;
    }

    const numTables = companyData?.numberOfTables || 0;

    return (
        <div className="container mx-auto p-4 space-y-6 pt-8 pb-32">
            <header className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Comandas</h1>
                    <p className="text-muted-foreground">Olá, <span className="font-bold text-foreground">{waiterName}</span>. Gerencie as mesas abaixo.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Mesa ou nome do cliente..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button size="sm" className="gap-1 shrink-0 bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsTokenModalOpen(true)}>
                        <Ticket className="w-4 h-4" /> Vender Ficha
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground gap-2 shrink-0" onClick={handleLogoutName}>
                        <LogOut className="w-4 h-4" /> Sair
                    </Button>
                </div>
            </header>

            {numTables === 0 ? (
                <Card className="text-center p-12 bg-muted/20">
                    <p className="text-lg font-semibold text-muted-foreground">Nenhuma mesa configurada para este estabelecimento.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: numTables }).map((_, i) => {
                        const tableNum = (i + 1).toString();
                        const tableData = tableStates[tableNum];
                        const isOccupied = !!tableData;
                        
                        // Busca por número da mesa ou nome do cliente
                        const searchLower = searchQuery.toLowerCase().trim();
                        if (searchLower) {
                            const matchesTable = tableNum.includes(searchLower) || `mesa ${tableNum}`.includes(searchLower);
                            const matchesCustomer = isOccupied && tableData.orders.some((o: any) => 
                                o.customerName?.toLowerCase().includes(searchLower)
                            );
                            
                            if (!matchesTable && !matchesCustomer) return null;
                        }

                        return (
                            <button
                                key={tableNum}
                                onClick={() => isOccupied ? setSelectedTable({ tableNumber: tableNum, ...tableData }) : router.push(`/waiter/${companyId}/dashboard/menu?table=${tableNum}&waiter=${encodeURIComponent(waiterName)}`)}
                                className={`relative flex flex-col items-center justify-center min-h-[120px] rounded-2xl border-2 transition-all active:scale-95 shadow-sm p-4 ${
                                    isOccupied 
                                    ? 'bg-orange-50 border-orange-200 hover:border-orange-400' 
                                    : 'bg-card border-muted hover:border-primary/50'
                                }`}
                            >
                                <span className={`absolute top-2 right-2 w-3 h-3 rounded-full ${isOccupied ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                                <Users className={`h-8 w-8 mb-2 ${isOccupied ? 'text-orange-600' : 'text-muted-foreground opacity-50'}`} />
                                <span className="text-lg font-bold">Mesa {tableNum}</span>
                                {isOccupied && (
                                    <>
                                        {tableData.orders.some((o: any) => o.customerName && o.customerName !== 'Cliente na Mesa') && (
                                            <span className="text-[10px] text-muted-foreground truncate w-full text-center px-1">
                                                {tableData.orders.find((o: any) => o.customerName && o.customerName !== 'Cliente na Mesa')?.customerName}
                                            </span>
                                        )}
                                        <span className="text-xs font-black text-orange-700 bg-orange-200/50 px-2 py-0.5 rounded-full mt-1">
                                            R$ {tableData.total.toFixed(2)}
                                        </span>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedTable && (
                <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
                    <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-2xl flex justify-between items-center pr-6">
                                <span>Mesa {selectedTable.tableNumber}</span>
                                <span className="text-primary font-bold">R$ {selectedTable.total.toFixed(2)}</span>
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2">
                             <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                                <h3 className="font-bold flex items-center gap-2 mb-4 text-primary"><ShoppingBag className="w-4 h-4" /> Consumo Atual</h3>
                                <div className="space-y-3">
                                    {selectedTable.orders.map((order: any) => (
                                        <div key={order.id} className="space-y-1">
                                            {order.orderItems.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="font-medium">{item.quantity}x {item.productName}</span>
                                                    <span className="text-muted-foreground text-xs">R$ {(item.finalPrice || item.unitPrice).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>

                        <div className="pt-4 border-t grid grid-cols-2 gap-3">
                            <Button variant="outline" onClick={() => setSelectedTable(null)}>Voltar</Button>
                            <Button className="gap-2" onClick={() => router.push(`/waiter/${companyId}/dashboard/menu?table=${selectedTable.tableNumber}&waiter=${encodeURIComponent(waiterName)}`)}>
                                <PlusCircle className="h-4 w-4" /> Adicionar Produtos
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Token Dialog */}
            <Dialog 
                open={isTokenModalOpen} 
                onOpenChange={(open) => {
                    setIsTokenModalOpen(open);
                    if (!open) {
                        setTokenProductSearch('');
                        setTokenSelectedProduct(null);
                        setTokenCustomerName('');
                        setTokenQuantity(1);
                        setTokenPaymentMethod('');
                        setIsTokenSearchOpen(false);
                        if (typeof document !== 'undefined') {
                            document.body.style.pointerEvents = 'auto';
                        }
                    }
                }}
            >
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Vender Ficha</DialogTitle>
                        <DialogDescription>Pesquise o produto e imprima a ficha para o cliente.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 space-y-2 relative">
                                <Label>Produto</Label>
                                <Input
                                    placeholder="Pesquise o produto..."
                                    value={tokenProductSearch}
                                    onChange={(e) => handleTokenProductSearchChange(e.target.value)}
                                    onFocus={() => setIsTokenSearchOpen(true)}
                                    onBlur={() => setTimeout(() => setIsTokenSearchOpen(false), 200)}
                                />
                                {isTokenSearchOpen && tokenProductSearch && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                                        {allProducts?.filter(p => p.name.toLowerCase().includes(tokenProductSearch.toLowerCase())).map(p => (
                                            <div
                                                key={p.id}
                                                className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer border-b last:border-0"
                                                onMouseDown={(e) => { e.preventDefault(); handleSelectTokenProduct(p); }}
                                            >
                                                <div className="font-medium truncate">{p.name}</div>
                                                <div className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)}</div>
                                            </div>
                                        ))}
                                        {allProducts?.filter(p => p.name.toLowerCase().includes(tokenProductSearch.toLowerCase())).length === 0 && (
                                            <div className="px-3 py-2 text-sm text-muted-foreground text-center">Nenhum encontrado.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="col-span-1 space-y-2">
                                <Label>Valor</Label>
                                <Input
                                    value={tokenSelectedProduct ? tokenSelectedProduct.price.toFixed(2) : '0.00'}
                                    disabled
                                    className="bg-muted text-center px-1"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Nome do Cliente <span className="text-xs text-muted-foreground font-normal">(Opcional)</span></Label>
                            <Input
                                placeholder="Nome do cliente (opcional)"
                                value={tokenCustomerName}
                                onChange={(e) => setTokenCustomerName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Quantidade de Fichas</Label>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="icon" onClick={() => setTokenQuantity(Math.max(1, tokenQuantity - 1))}><Minus className="h-4 w-4" /></Button>
                                <span className="font-bold text-lg w-8 text-center">{tokenQuantity}</span>
                                <Button variant="outline" size="icon" onClick={() => setTokenQuantity(tokenQuantity + 1)}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Forma de Pagamento</Label>
                            <Select value={tokenPaymentMethod} onValueChange={setTokenPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyData?.paymentMethods?.cash !== false && <SelectItem value="Dinheiro">Dinheiro</SelectItem>}
                                    {companyData?.paymentMethods?.credit !== false && <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>}
                                    {companyData?.paymentMethods?.debit !== false && <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>}
                                    {companyData?.paymentMethods?.pix !== false && <SelectItem value="PIX">PIX</SelectItem>}
                                    {!companyData?.paymentMethods && <SelectItem value="Dinheiro">Dinheiro</SelectItem>}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTokenModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSellToken} disabled={isProcessingToken || !tokenSelectedProduct || tokenQuantity <= 0 || !tokenPaymentMethod}>
                            {isProcessingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                            Vender e Imprimir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
