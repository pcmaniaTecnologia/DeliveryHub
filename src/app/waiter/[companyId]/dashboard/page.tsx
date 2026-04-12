'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, type Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, PlusCircle, Receipt, ShoppingBag, LogOut, Search, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    const [nameInput, setNameInput] = useState('');
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem(`waiter_name_${companyId}`);
        if (saved) setWaiterName(saved);
    }, [companyId]);

    const handleSetName = () => {
        if (!nameInput.trim()) return;
        localStorage.setItem(`waiter_name_${companyId}`, nameInput);
        setWaiterName(nameInput);
    };

    const handleLogoutName = () => {
        localStorage.removeItem(`waiter_name_${companyId}`);
        setWaiterName(null);
        setNameInput('');
    };

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return doc(firestore, 'companies', companyId);
    }, [firestore, companyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc<{ numberOfTables?: number, name?: string }>(companyRef);

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return collection(firestore, `companies/${companyId}/orders`);
    }, [firestore, companyId]);

    const { data: allOrders, isLoading: isLoadingOrders, error: orderError } = useCollection<Order>(ordersRef);

    const tableStates = useMemo(() => {
        if (!allOrders || !companyData) return {};
        
        const activeOrders = allOrders.filter(
            o => (o.deliveryType === 'Mesa' || o.tableNumber) && o.status !== 'Entregue' && o.status !== 'Cancelado'
        );

        return activeOrders.reduce((acc, order) => {
            const table = String(order.tableNumber || '0').trim();
            if (!acc[table]) {
                acc[table] = { orders: [], total: 0 };
            }
            acc[table].orders.push(order);
            acc[table].total += Number(order.totalAmount || 0);
            return acc;
        }, {} as Record<string, { orders: any[], total: number }>);
    }, [allOrders, companyData]);

    if (isLoadingCompany || isLoadingOrders) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!waiterName) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">Acesso do Garçom</CardTitle>
                        <p className="text-muted-foreground">{companyData?.name || 'Bem-vindo!'}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Digite seu nome para começar:</label>
                            <Input 
                                placeholder="Seu nome aqui..." 
                                value={nameInput} 
                                onChange={(e) => setNameInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
                            />
                        </div>
                        <Button className="w-full h-12 text-lg" onClick={handleSetName} disabled={!nameInput.trim()}>
                            Entrar no Sistema
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const numTables = companyData?.numberOfTables || 0;

    return (
        <div className="container mx-auto p-4 space-y-6 pt-8 pb-32">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Comandas</h1>
                    <p className="text-muted-foreground text-sm">Gerencie o consumo das mesas em tempo real.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full border">
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold">{waiterName}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleLogoutName} title="Sair">
                        <LogOut className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            {orderError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-6 text-sm">
                    <p className="font-bold">Erro ao carregar pedidos:</p>
                    <p className="opacity-80">{orderError.message}</p>
                </div>
            )}

            <div className="relative w-full sm:w-64 mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Mesa ou nome do cliente..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {numTables === 0 ? (
                <Card className="text-center p-12 bg-muted/20 border-dashed">
                    <p className="text-lg font-semibold text-muted-foreground">Nenhuma mesa configurada para este estabelecimento.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: numTables }).map((_, i) => {
                        const tableNum = (i + 1).toString();
                        const tableData = tableStates[tableNum];
                        const isOccupied = !!tableData;
                        
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
                                className={`relative flex flex-col items-center justify-center min-h-[140px] rounded-2xl border-2 transition-all active:scale-95 shadow-sm p-4 ${
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
                                        <span className="text-xs font-black text-orange-700 bg-orange-200/50 px-2 py-0.5 rounded-full mt-1">
                                            R$ {tableData.total.toFixed(2)}
                                        </span>
                                        {tableData.orders[0]?.customerName && tableData.orders[0]?.customerName !== 'Cliente na Mesa' && (
                                            <span className="text-[10px] text-muted-foreground truncate w-full mt-1">
                                                {tableData.orders[0].customerName}
                                            </span>
                                        )}
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
                                <div className="space-y-4">
                                    {selectedTable.orders.map((order: any, orderIdx: number) => (
                                        <div key={order.id} className="space-y-1">
                                            <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold border-b pb-1 mb-1">
                                                <span>Pedido #{order.id.substring(0,4)}</span>
                                                {order.waiterName && <span>Por: {order.waiterName}</span>}
                                            </div>
                                            {order.orderItems.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="font-medium">{item.quantity}x {item.productName}</span>
                                                    <span className="font-bold text-xs font-mono">R$ {(item.finalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
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
                                <PlusCircle className="h-4 w-4" /> Adicionar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
