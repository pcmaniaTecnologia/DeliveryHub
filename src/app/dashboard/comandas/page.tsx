'use client';

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useUser, useDoc, updateDocument, addDocument, deleteDocument, errorEmitter, FirestorePermissionError, useMemoFirebase } from '@/firebase';
import { collection, doc, type Timestamp, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useImpersonation } from '@/context/impersonation-context';
import { Loader2, Users, Receipt, Clock, CheckCircle2, PlusCircle, Trash2, Plus, X, Calculator, ShoppingBag, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { recordCashierSale } from '@/lib/utils';

type OrderItem = {
    id: string;
    orderId: string;
    productId: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    finalPrice?: number;
    notes?: string;
    selectedVariants?: { groupName: string; itemName: string; price: number }[];
};

type Order = {
    id: string;
    orderDate: Timestamp;
    status: string;
    deliveryType: string;
    tableNumber?: string;
    waiterName?: string;
    customerName?: string;
    orderItems: OrderItem[];
    totalAmount: number;
};

export default function ComandasPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { isImpersonating, impersonatedCompanyId } = useImpersonation();
    const { toast } = useToast();
    const router = useRouter();
    
    const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return doc(firestore, 'companies', effectiveCompanyId);
    }, [firestore, effectiveCompanyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc<{ numberOfTables?: number }>(companyRef);

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return collection(firestore, `companies/${effectiveCompanyId}/orders`);
    }, [firestore, effectiveCompanyId]);

    const { data: allOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);

    const allTables = useMemo(() => {
        if (!allOrders) return [];

        // Filter orders that belong to tables and are not closed
        const tableOrders = allOrders.filter(
            order => (order.deliveryType === 'Mesa' || order.tableNumber) 
                     && order.status !== 'Entregue' 
                     && order.status !== 'Cancelado'
        );

        // Group by table number
        const grouped = tableOrders.reduce((acc, order) => {
            const table = String(order.tableNumber || 'Sem Número').trim();
            const orderTime = order.orderDate && typeof order.orderDate.toMillis === 'function' 
                ? order.orderDate.toMillis() 
                : (order.orderDate ? new Date(order.orderDate as any).getTime() : Date.now());

            if (!acc[table]) {
                acc[table] = {
                    tableNumber: table,
                    orders: [],
                    totalAmount: 0,
                    oldestOrderTime: orderTime,
                    waiters: new Set<string>(),
                    customerNames: new Set<string>()
                };
            }
            acc[table].orders.push(order);
            acc[table].totalAmount += Number(order.totalAmount || 0);
            if (order.waiterName) acc[table].waiters.add(order.waiterName);
            if (order.customerName && order.customerName !== 'Cliente na Mesa') acc[table].customerNames.add(order.customerName);
            
            if (orderTime < acc[table].oldestOrderTime) {
                acc[table].oldestOrderTime = orderTime;
            }
            return acc;
        }, {} as Record<string, any>);

        const numTablesConfigured = companyData?.numberOfTables || 0;
        const finalTables = [];

        // Add configured tables
        for (let i = 1; i <= numTablesConfigured; i++) {
            const tableStr = i.toString();
            if (grouped[tableStr]) {
                finalTables.push(grouped[tableStr]);
                delete grouped[tableStr];
            } else {
                finalTables.push({
                    tableNumber: tableStr,
                    isFree: true,
                    orders: [],
                    totalAmount: 0,
                });
            }
        }

        // Add remaining active tables (e.g. named tables like "Varanda")
        const leftovers = Object.values(grouped).sort((a: any, b: any) => {
            const aNum = parseInt(a.tableNumber);
            const bNum = parseInt(b.tableNumber);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return (a.tableNumber || '').localeCompare(b.tableNumber || '');
        });

        return [...finalTables, ...leftovers];
    }, [allOrders, companyData?.numberOfTables]);

    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [isCheckoutMode, setIsCheckoutMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTables = useMemo(() => {
        if (!searchQuery.trim()) return allTables;
        
        const query = searchQuery.toLowerCase();
        
        return allTables.filter((table) => {
            if (table?.tableNumber && table.tableNumber.toString().toLowerCase().includes(query)) return true;
            if (table?.customerNames) {
                const customers = Array.from(table.customerNames);
                if (customers.some((name: any) => typeof name === 'string' && name.toLowerCase().includes(query))) {
                    return true;
                }
            }
            return false;
        });
    }, [allTables, searchQuery]);
    
    // Checkout states
    const [selectedItemsKeys, setSelectedItemsKeys] = useState<Set<string>>(new Set());
    const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
    const [newPaymentMethod, setNewPaymentMethod] = useState('Dinheiro');
    const [newPaymentAmount, setNewPaymentAmount] = useState('');

    // Pre-calculate items for the selected table
    const tableItems = useMemo(() => {
        if (!selectedTable) return [];
        const items: any[] = [];
        (selectedTable.orders || []).forEach((order: Order) => {
            (order.orderItems || []).forEach((item, idx) => {
                items.push({
                    ...item,
                    orderId: order.id,
                    roundIdx: idx,
                    uniqueKey: `${order.id}-${idx}`,
                    originalOrder: order
                });
            });
        });
        return items;
    }, [selectedTable]);

    const itemsToPayTotal = useMemo(() => {
        return tableItems
            .filter(item => selectedItemsKeys.has(item.uniqueKey))
            .reduce((sum, item) => sum + (item.finalPrice || (item.unitPrice * item.quantity)), 0);
    }, [tableItems, selectedItemsKeys]);

    const totalPaid = useMemo(() => {
        return payments.reduce((sum, p) => sum + p.amount, 0);
    }, [payments]);

    const balanceRemaining = itemsToPayTotal - totalPaid;

    const toggleItemSelection = (key: string) => {
        const newSet = new Set(selectedItemsKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setSelectedItemsKeys(newSet);
    };

    const selectAllItems = () => {
        if (selectedItemsKeys.size === tableItems.length) {
            setSelectedItemsKeys(new Set());
        } else {
            setSelectedItemsKeys(new Set(tableItems.map(i => i.uniqueKey)));
        }
    };

    const addPayment = () => {
        const amt = parseFloat(newPaymentAmount.replace(',', '.'));
        if (isNaN(amt) || amt <= 0) return;
        setPayments([...payments, { method: newPaymentMethod, amount: amt }]);
        setNewPaymentAmount('');
    };

    const removePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleCheckout = async () => {
        if (!firestore || !effectiveCompanyId || !selectedTable) return;
        if (selectedItemsKeys.size === 0) {
            toast({ variant: 'destructive', title: "Selecione pelo menos um item" });
            return;
        }
        if (balanceRemaining > 0.01) {
            toast({ variant: 'destructive', title: "O valor pago é insuficiente" });
            return;
        }

        try {
            const ordersRef = collection(firestore, 'companies', effectiveCompanyId, 'orders');
            const itemsBeingPaid = tableItems.filter(item => selectedItemsKeys.has(item.uniqueKey));
            const paymentSummary = payments.map(p => `${p.method}: R$ ${p.amount.toFixed(2)}`).join(' | ');
            
            // 2. Identify unique orders involved
            const ordersToProcess = new Set(itemsBeingPaid.map(i => i.orderId));
            const finalizedOrderIds: string[] = [];
            
            for (const orderId of Array.from(ordersToProcess)) {
                finalizedOrderIds.push(orderId);
                const originalOrder = selectedTable.orders.find((o: Order) => o.id === orderId);
                if (!originalOrder) continue;

                const itemsSelectedInThisOrder = itemsBeingPaid.filter(i => i.orderId === orderId);
                const itemsRemainingInThisOrder = (originalOrder.orderItems || []).filter((_: any, idx: number) => !selectedItemsKeys.has(`${orderId}-${idx}`));
                
                const orderRef = doc(firestore, `companies/${effectiveCompanyId}/orders`, orderId);
                
                if (itemsRemainingInThisOrder.length === 0) {
                    // SE TODOS OS ITENS DESTE PEDIDO FORAM PAGOS:
                    // Apenas atualizamos o status para Entregue e gravamos o pagamento.
                    await updateDocument(orderRef, {
                        status: 'Entregue',
                        paymentMethod: paymentSummary,
                        payments: payments,
                        notes: (originalOrder.notes ? originalOrder.notes + " | " : "") + "Pagamentos: " + paymentSummary
                    });
                } else {
                    // SE APENAS ALGUNS ITENS DESTE PEDIDO FORAM PAGOS:
                    // 1. Criamos um novo pedido com os itens pagos (Status 'Novo' para garantir permissão, depois 'Entregue')
                    const newOrderRef = await addDocument(ordersRef, {
                        companyId: effectiveCompanyId,
                        customerId: 'waiter_system',
                        customerName: originalOrder.customerName || 'Cliente na Mesa',
                        orderDate: serverTimestamp(),
                        status: 'Novo',
                        deliveryType: 'Mesa',
                        tableNumber: selectedTable.tableNumber,
                        deliveryFee: 0,
                        paymentMethod: paymentSummary,
                        payments: payments,
                        orderItems: itemsSelectedInThisOrder.map(item => ({
                            productId: item.productId,
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            finalPrice: item.finalPrice,
                            notes: item.notes || '',
                            selectedVariants: item.selectedVariants || [],
                        })),
                        totalAmount: itemsSelectedInThisOrder.reduce((sum, i) => sum + (i.finalPrice || (i.unitPrice * i.quantity)), 0),
                        notes: "Pagamento Parcial da Mesa. Origem: " + orderId
                    });

                    // 2. Atualizamos o novo pedido para 'Entregue'
                    finalizedOrderIds.push(newOrderRef.id);
                    await updateDocument(doc(firestore, `companies/${effectiveCompanyId}/orders`, newOrderRef.id), {
                        status: 'Entregue'
                    });

                    // 3. Atualizamos o pedido original para REMOVER os itens pagos
                    const newTotal = itemsRemainingInThisOrder.reduce((sum: number, item: any) => sum + (item.finalPrice || (item.unitPrice * item.quantity)), 0);
                    await updateDocument(orderRef, {
                        orderItems: itemsRemainingInThisOrder,
                        totalAmount: newTotal
                    });
                }
            }

            // Registra a venda no caixa se houver um aberto
            try {
                // Usamos o total que foi pago nesta transação (itemsToPayTotal)
                const result = await recordCashierSale(
                    firestore, 
                    effectiveCompanyId, 
                    itemsToPayTotal, 
                    `Comanda Mesa ${selectedTable.tableNumber} (${itemsBeingPaid.length} itens)`, 
                    Array.from(ordersToProcess)[0],
                    paymentSummary
                );

                if (result && result.success && result.sessionId) {
                    // Vincula o sessionId a todos os pedidos processados nesta batida
                    for (const id of finalizedOrderIds) {
                        await updateDocument(doc(firestore, `companies/${effectiveCompanyId}/orders`, id), {
                            sessionId: result.sessionId
                        });
                    }
                }
            } catch (cashierErr) {
                console.error('Erro ao registrar comanda no caixa:', cashierErr);
            }

            toast({ title: "Pagamento realizado!", description: `Mesa ${selectedTable.tableNumber} atualizada.` });
            
            // Reset state
            setIsCheckoutMode(false);
            setSelectedItemsKeys(new Set());
            setPayments([]);
            setSelectedTable(null);

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Erro ao processar checkout" });
        }
    };

    if (isLoadingOrders || isLoadingCompany) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Comandas (Mesas em Consumo)</h2>
                    <p className="text-muted-foreground">Monitore o consumo das mesas ativas no restaurante em tempo real.</p>
                </div>
                {allTables.length > 0 && (
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar mesa ou cliente..."
                            className="pl-9 bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {allTables.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 bg-muted/20">
                    <Receipt className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-xl font-medium">Nenhuma mesa configurada</h3>
                    <p className="text-muted-foreground mt-1 text-center max-w-sm">Você não configurou o número de mesas em <br/><strong>Configurações &gt; Empresa</strong>.</p>
                </Card>
            ) : filteredTables.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-16 bg-muted/20">
                    <Search className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-xl font-medium">Nenhum resultado encontrado</h3>
                    <p className="text-muted-foreground mt-1 text-center max-w-sm">Não encontramos nenhuma mesa ou cliente com "{searchQuery}".</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {filteredTables.map((table) => {
                        if (table.isFree) {
                            return (
                                <Card key={`free-${table.tableNumber}`} className="overflow-hidden border-dashed hover:border-primary/50 transition-colors shadow-sm bg-muted/5">
                                    <div className="bg-muted px-4 py-3 border-b flex justify-between items-center text-muted-foreground">
                                        <div className="flex items-center gap-2 font-semibold text-lg">
                                            <Users className="h-5 w-5" />
                                            Mesa {table.tableNumber}
                                        </div>
                                        <Badge variant="secondary" className="bg-background">Livre</Badge>
                                    </div>
                                    <CardContent className="p-4 flex flex-col items-center justify-center space-y-3 min-h-[110px]">
                                         <Button variant="ghost" className="w-full text-primary gap-2" onClick={() => router.push(`/waiter/${effectiveCompanyId}/dashboard/menu?table=${table.tableNumber}&admin=true`)}>
                                             <PlusCircle className="h-4 w-4" /> Abrir Comanda
                                         </Button>
                                    </CardContent>
                                </Card>
                            );
                        }

                        const oldestTime = table.oldestOrderTime || Date.now();
                        const minsOpen = Math.floor((Date.now() - oldestTime) / 60000);
                        const waitersArray = Array.from(table.waiters).filter(Boolean);
                        const customersArray = Array.from(table.customerNames).filter(Boolean);

                        return (
                            <Card key={table.tableNumber} className="overflow-hidden hover:border-primary/50 transition-colors shadow-sm cursor-pointer" onClick={() => setSelectedTable(table)}>
                                <div className="bg-primary/10 px-4 py-3 border-b flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-primary font-bold text-lg">
                                        <Users className="h-5 w-5" />
                                        Mesa {table.tableNumber}
                                    </div>
                                    <Badge variant="outline" className="bg-background">
                                        {table.orders.length} {table.orders.length === 1 ? 'pedido' : 'pedidos'}
                                    </Badge>
                                </div>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between text-2xl font-bold">
                                        <span>R$ {table.totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            <span>Aberta há {minsOpen} min</span>
                                        </div>
                                        {waitersArray.length > 0 && (
                                            <div className="text-xs">
                                                Atendida por: {waitersArray.join(', ')}
                                            </div>
                                        )}
                                        {customersArray.length > 0 && (
                                            <div className="text-xs font-medium text-foreground">
                                                Cliente: {customersArray.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal for Table Details */}
            {selectedTable && (
                <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
                    <DialogContent className="sm:max-w-xl w-[98vw] max-h-[92vh] flex flex-col p-4 sm:p-6">
                        <DialogHeader>
                            <DialogTitle className="text-2xl flex justify-between items-center pr-6">
                                <span>Mesa {selectedTable.tableNumber}</span>
                                <span className="text-primary font-bold">R$ {selectedTable.totalAmount.toFixed(2)}</span>
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2">
                             {isCheckoutMode ? (
                                <div className="space-y-6">
                                    {/* ... rest of checkout view ... */}
                                    <div className="bg-muted/30 rounded-xl p-4 border border-primary/20">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Itens para Pagar</h3>
                                            <Button variant="ghost" size="sm" onClick={selectAllItems} className="text-xs h-7 px-2">
                                                {selectedItemsKeys.size === tableItems.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {tableItems.map((item) => (
                                                <div 
                                                    key={item.uniqueKey} 
                                                    className={`flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer ${selectedItemsKeys.has(item.uniqueKey) ? 'bg-primary/5 border-primary/30' : 'bg-background hover:bg-muted/50'}`}
                                                    onClick={() => toggleItemSelection(item.uniqueKey)}
                                                >
                                                    <Checkbox checked={selectedItemsKeys.has(item.uniqueKey)} onCheckedChange={() => toggleItemSelection(item.uniqueKey)} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{item.quantity}x {item.productName}</p>
                                                        {item.selectedVariants && item.selectedVariants.length > 0 && (
                                                            <p className="text-[10px] text-muted-foreground truncate">{item.selectedVariants.map((v: any) => v.itemName).join(', ')}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-bold">R$ {(item.finalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                            <span className="text-sm font-medium">Subtotal Selecionado:</span>
                                            <span className="text-lg font-black text-primary">R$ {itemsToPayTotal.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                                        <h3 className="font-bold flex items-center gap-2 mb-4"><Calculator className="w-4 h-4" /> Forma de Pagamento</h3>
                                        
                                        <div className="flex gap-2 mb-4">
                                            <select 
                                                className="flex h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={newPaymentMethod} 
                                                onChange={(e) => setNewPaymentMethod(e.target.value)}
                                            >
                                                <option value="Dinheiro">Dinheiro</option>
                                                <option value="PIX">PIX</option>
                                                <option value="Cartão de Crédito">Crédito</option>
                                                <option value="Cartão de Débito">Débito</option>
                                            </select>
                                            <Input 
                                                type="text" 
                                                placeholder="R$ 0,00" 
                                                className="flex-1"
                                                value={newPaymentAmount}
                                                onChange={(e) => setNewPaymentAmount(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && addPayment()}
                                            />
                                            <Button size="icon" onClick={addPayment} disabled={!newPaymentAmount}><Plus className="w-4 h-4" /></Button>
                                        </div>

                                        {payments.length > 0 && (
                                            <div className="space-y-2 mb-4">
                                                {payments.map((p, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-background rounded-lg p-2 text-sm border shadow-sm">
                                                        <span className="font-medium">{p.method}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold">R$ {p.amount.toFixed(2)}</span>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePayment(idx)}><Trash2 className="w-3 h-3" /></Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className={`p-3 rounded-lg border flex justify-between items-center ${balanceRemaining <= 0.01 ? 'bg-green-100 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                            <span className="text-sm font-medium">{balanceRemaining <= 0.01 ? 'Total Pago!' : 'Faltando:'}</span>
                                            <span className="text-lg font-black">R$ {Math.max(0, balanceRemaining).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                (selectedTable.orders || [])
                                    .sort((a: any, b: any) => {
                                        const atime = a.orderDate && typeof a.orderDate.toMillis === 'function' ? a.orderDate.toMillis() : 0;
                                        const btime = b.orderDate && typeof b.orderDate.toMillis === 'function' ? b.orderDate.toMillis() : 0;
                                        return atime - btime;
                                    })
                                    .map((order: any, idx: number) => {
                                        const orderTime = order.orderDate && typeof order.orderDate.toMillis === 'function' 
                                            ? order.orderDate.toMillis() 
                                            : null;
                                        
                                        return (
                                            <div key={order.id} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-sm text-muted-foreground">
                                                        Rodada {idx + 1} 
                                                        {orderTime && ` • ${new Date(orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    </h4>
                                                    <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                                                </div>
                                                <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
                                                    {(order.orderItems || []).map((item: any, itemIdx: number) => {
                                                        const itemPriceStr = (item.finalPrice || item.unitPrice || 0).toFixed(2);
                                                        return (
                                                            <div key={itemIdx} className="text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="font-medium">{item.quantity}x {item.productName}</span>
                                                                    <span>R$ {itemPriceStr}</span>
                                                                </div>
                                                                {item.selectedVariants && item.selectedVariants.length > 0 && (
                                                                    <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                                                                        {item.selectedVariants.map((v: any) => `${v.itemName}${v.price > 0 ? ` (+R$${v.price.toFixed(2)})` : ''}`).join(', ')}
                                                                    </p>
                                                                )}
                                                                {item.notes && <p className="text-xs italic text-muted-foreground mt-0.5 ml-4">Obs: {item.notes}</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto w-full">
                            {isCheckoutMode ? (
                                <>
                                    <Button variant="ghost" className="gap-2" onClick={() => { setIsCheckoutMode(false); setPayments([]); setSelectedItemsKeys(new Set()); }}>
                                        <X className="h-4 w-4" /> Cancelar
                                    </Button>
                                    <Button 
                                        className="gap-2 w-full sm:w-auto bg-green-600 hover:bg-green-700" 
                                        disabled={balanceRemaining > 0.01 || selectedItemsKeys.size === 0}
                                        onClick={handleCheckout}
                                    >
                                        <CheckCircle2 className="h-4 w-4" /> Confirmar Pagamento
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outline" className="gap-2 shrink-0 w-full sm:w-auto" onClick={() => router.push(`/waiter/${effectiveCompanyId}/dashboard/menu?table=${selectedTable.tableNumber}&admin=true`)}>
                                        <PlusCircle className="h-4 w-4" /> Adicionar Produtos
                                    </Button>
                                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                        <Button variant="outline" onClick={() => setSelectedTable(null)}>Voltar</Button>
                                        <Button className="gap-2 w-full sm:w-auto bg-primary text-primary-foreground" onClick={() => setIsCheckoutMode(true)}>
                                            <Receipt className="h-4 w-4" /> Abrir Caixa / Checkout
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
