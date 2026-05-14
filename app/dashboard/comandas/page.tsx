'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useFirestore, useCollection, useUser, useDoc, updateDocument, addDocument, deleteDocument, setDocument, errorEmitter, FirestorePermissionError, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, limit, type Timestamp, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useImpersonation } from '@/context/impersonation-context';
import { Loader2, Users, User, Receipt, Clock, CheckCircle2, PlusCircle, Trash2, Plus, Minus, X, Calculator, ShoppingBag, Search, Tag, Wallet, HandCoins, ArrowDownCircle, Banknote, Lock, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { recordCashierSale } from '@/lib/finance-utils';
import { formatQuantity } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    isSoldByWeight?: boolean;
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

    // ─── Sessão de Caixa Aberta ───────────────────────────────────────────
    const openSessionRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return query(
            collection(firestore, `companies/${effectiveCompanyId}/cashier_sessions`),
            where('status', '==', 'open'),
            limit(1)
        );
    }, [firestore, effectiveCompanyId]);

    type CashSession = { id: string; status: string; openingBalance: number; openedAt: Timestamp };
    const { data: openSessions } = useCollection<CashSession>(openSessionRef);
    const currentCashSession = openSessions?.[0] ?? null;

    // ─── Estado de Controle Removido ───

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return doc(firestore, 'companies', effectiveCompanyId);
    }, [firestore, effectiveCompanyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc<any>(companyRef);

    const themeColors = useMemo(() => {
        if (!companyData?.themeColors) return { primary: '#6366f1', accent: '#f59e0b' };
        try {
            const parsed = typeof companyData.themeColors === 'string' 
                ? JSON.parse(companyData.themeColors) 
                : companyData.themeColors;
            return {
                primary: parsed.primary || '#6366f1',
                accent: parsed.accent || '#f59e0b'
            };
        } catch (e) {
            return { primary: '#6366f1', accent: '#f59e0b' };
        }
    }, [companyData]);

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return collection(firestore, `companies/${effectiveCompanyId}/orders`);
    }, [firestore, effectiveCompanyId]);

    const { data: allOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);
    
    const reservationsRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return collection(firestore, `companies/${effectiveCompanyId}/tableReservations`);
    }, [firestore, effectiveCompanyId]);

    const { data: allReservations, isLoading: isLoadingReservations } = useCollection<{ id: string, customerName?: string }>(reservationsRef);

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

            const meta = companyData?.tableMetadata?.[table];
            if (!acc[table]) {
                const reservation = allReservations?.find(r => r.id === table);
                acc[table] = {
                    tableNumber: table,
                    orders: [],
                    totalAmount: 0,
                    oldestOrderTime: orderTime,
                    waiters: new Set<string>(),
                    customerNames: new Set<string>(),
                    isReserved: !!reservation,
                    reservationName: reservation?.customerName,
                    customerNameFromMeta: meta?.customerName,
                    occupants: meta?.occupants || 1
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
                const meta = companyData?.tableMetadata?.[tableStr];
                const reservation = allReservations?.find(r => r.id === tableStr);
                finalTables.push({
                    tableNumber: tableStr,
                    isFree: true,
                    orders: [],
                    totalAmount: 0,
                    isReserved: !!reservation,
                    reservationName: reservation?.customerName,
                    customerNameFromMeta: meta?.customerName,
                    occupants: meta?.occupants || 1,
                    waiters: new Set<string>(),
                    customerNames: new Set<string>(),
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
    }, [allOrders, companyData?.numberOfTables, allReservations]);

    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [isCheckoutMode, setIsCheckoutMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [tableOccupants, setTableOccupants] = useState(1);
    const [tableCustomerName, setTableCustomerName] = useState('');

    useEffect(() => {
        if (selectedTable && companyData?.tableMetadata?.[selectedTable.tableNumber]) {
            const meta = companyData.tableMetadata[selectedTable.tableNumber];
            setTableOccupants(meta.occupants || 1);
            setTableCustomerName(meta.customerName || '');
        } else {
            setTableOccupants(1);
            setTableCustomerName('');
        }
    }, [companyData?.tableMetadata, selectedTable]);

    const handleUpdateTableMetadata = async (name?: string, occupants?: number) => {
        if (!companyRef || !selectedTable) return;
        
        const tableId = String(selectedTable.tableNumber);
        const currentMeta = companyData?.tableMetadata?.[tableId] || {};

        await updateDocument(companyRef, {
            [`tableMetadata.${tableId}`]: {
                customerName: name !== undefined ? name : (tableCustomerName || currentMeta.customerName || ''),
                occupants: occupants !== undefined ? occupants : (tableOccupants || currentMeta.occupants || 1),
                updatedAt: serverTimestamp()
            }
        });
    };

    // ─── Contribuições parciais (dinheiro deixado na mesa) ───────────────
    const contributionsRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId || !selectedTable) return null;
        return collection(firestore, 'companies', effectiveCompanyId, 'tableContributions');
    }, [firestore, effectiveCompanyId, selectedTable]);

    const { data: allContributions } = useCollection<{ tableNumber: string; amount: number; method: string; note?: string; createdAt: any }>(contributionsRef);

    const tableContributions = useMemo(() => {
        if (!allContributions || !selectedTable) return [];
        return allContributions.filter(c => String(c.tableNumber) === String(selectedTable.tableNumber));
    }, [allContributions, selectedTable]);

    const totalContributions = useMemo(() => tableContributions.reduce((s, c) => s + (c.amount || 0), 0), [tableContributions]);

    const [contribMethod, setContribMethod] = useState('Dinheiro');
    const [contribAmount, setContribAmount] = useState('');
    const [contribNote, setContribNote] = useState('');
    const [isSavingContrib, setIsSavingContrib] = useState(false);

    // Reservation State
    const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
    const [reserveTableNum, setReserveTableNum] = useState('');
    const [reserveCustName, setReserveCustName] = useState('');
    const [isSavingReservation, setIsSavingReservation] = useState(false);
    
    // Transfer State
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [transferToTable, setTransferToTable] = useState('');
    const [isSavingTransfer, setIsSavingTransfer] = useState(false);

    const handleReserveTable = async () => {
        if (!reserveTableNum || !reserveCustName || !effectiveCompanyId) return;
        setIsSavingReservation(true);
        try {
            await setDocument(doc(firestore, `companies/${effectiveCompanyId}/tableReservations`, reserveTableNum), {
                id: reserveTableNum,
                customerName: reserveCustName,
                createdAt: serverTimestamp()
            });
            setIsReserveDialogOpen(false);
            setReserveCustName('');
            toast({ title: 'Mesa reservada com sucesso!' });
        } catch (error) {
            console.error("Error reserving table:", error);
            toast({ variant: 'destructive', title: 'Erro ao reservar mesa' });
        } finally {
            setIsSavingReservation(false);
        }
    };

    const handleCancelReservation = async (tableNum: any, keepSelected = false) => {
        if (!effectiveCompanyId) return;
        try {
            await deleteDocument(doc(firestore, `companies/${effectiveCompanyId}/tableReservations`, String(tableNum)));
            toast({ title: 'Reserva cancelada' });
            // Se estivermos visualizando a mesa, voltamos para a tela principal (a menos que keepSelected seja true)
            if (!keepSelected) setSelectedTable(null);
        } catch (error) {
            console.error("Error canceling reservation:", error);
            toast({ variant: 'destructive', title: 'Erro ao cancelar reserva' });
        }
    };

    const handleTransferTable = async () => {
        if (!selectedTable || !transferToTable || !effectiveCompanyId) return;
        setIsSavingTransfer(true);
        try {
            // Find orders for the current selected table
            const tableOrders = allOrders?.filter(o => 
                (o.deliveryType === 'Mesa' || o.tableNumber) && 
                String(o.tableNumber) === String(selectedTable.tableNumber) && 
                o.status !== 'Entregue' && o.status !== 'Cancelado'
            );

            if (!tableOrders || tableOrders.length === 0) {
                toast({ variant: 'destructive', title: 'Não há pedidos ativos nesta mesa' });
                return;
            }

            for (const order of tableOrders) {
                await updateDocument(doc(firestore, `companies/${effectiveCompanyId}/orders`, order.id), {
                    tableNumber: transferToTable,
                    deliveryAddress: `Mesa ${transferToTable}`
                });
            }
            
            setIsTransferDialogOpen(false);
            setTransferToTable('');
            setSelectedTable(null);
            toast({ title: `Consumo transferido para a mesa ${transferToTable}` });
        } catch (error) {
            console.error("Error transferring table:", error);
            toast({ variant: 'destructive', title: 'Erro ao transferir mesa' });
        } finally {
            setIsSavingTransfer(false);
        }
    };

    const handleAddContribution = async () => {
        const amt = parseFloat(contribAmount.replace(',', '.'));
        if (isNaN(amt) || amt <= 0 || !contributionsRef || !effectiveCompanyId) return;
        setIsSavingContrib(true);
        try {
            await addDocument(contributionsRef, {
                tableNumber: String(selectedTable.tableNumber),
                amount: amt,
                method: contribMethod,
                note: contribNote.trim() || null,
                createdAt: serverTimestamp(),
            });
            setContribAmount('');
            setContribNote('');
            toast({ title: '✅ Contribuição registrada!', description: `R$ ${amt.toFixed(2)} adicionado à mesa ${selectedTable.tableNumber}.` });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Erro ao registrar contribuição' });
        }
        setIsSavingContrib(false);
    };

    const handleDeleteContribution = async (id: string) => {
        if (!firestore || !effectiveCompanyId) return;
        const ref = doc(firestore, 'companies', effectiveCompanyId, 'tableContributions', id);
        await deleteDocument(ref);
    };

    const clearTableContributions = async (tableNumber: string) => {
        if (!firestore || !effectiveCompanyId || !allContributions) return;
        const toDelete = allContributions.filter(c => String(c.tableNumber) === String(tableNumber));
        for (const c of toDelete) {
            const ref = doc(firestore, 'companies', effectiveCompanyId, 'tableContributions', c.id);
            await deleteDocument(ref);
        }
    };

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
    // Abatimentos parciais por item: { [uniqueKey]: valorAbatido }
    const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
    // Controla qual item está com campo de desconto aberto
    const [discountOpenKey, setDiscountOpenKey] = useState<string | null>(null);
    const [discountInput, setDiscountInput] = useState('');

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
            .reduce((sum, item) => {
                const base = item.finalPrice || (item.unitPrice * item.quantity);
                const discount = itemDiscounts[item.uniqueKey] || 0;
                return sum + Math.max(0, base - discount);
            }, 0);
    }, [tableItems, selectedItemsKeys, itemDiscounts]);

    const handlePrintConference = () => {
        if (!selectedTable) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const total = itemsToPayTotal > 0 ? itemsToPayTotal : selectedTable.totalAmount;
        const perPerson = total / tableOccupants;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Conferência de Mesa - ${selectedTable.tableNumber}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0 auto; padding: 10px; color: #000; }
                        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                        .item { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
                        .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 16px; }
                        .division { background: #f0f0f0; margin-top: 10px; padding: 10px; text-align: center; border: 1px solid #000; }
                        .footer { margin-top: 20px; text-align: center; font-size: 12px; border-top: 1px dashed #000; padding-top: 10px; }
                        @media print { body { width: 100%; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2 style="margin: 0;">CONFERÊNCIA DE MESA</h2>
                        <p style="margin: 5px 0;">Mesa: ${selectedTable.tableNumber}</p>
                        ${tableCustomerName ? `<p style="margin: 0;">Cliente: ${tableCustomerName}</p>` : ''}
                        <p style="margin: 0;">Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                    </div>
                    
                    <div>
                        ${tableItems.map((item: any) => `
                            <div class="item">
                                <span>${item.quantity}x ${item.productName}</span>
                                <span>R$ ${(item.finalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="total">
                        <div class="item">
                            <span>TOTAL CONSUMO</span>
                            <span>R$ ${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div class="division">
                        <p style="margin: 0; font-size: 14px;">DIVISÃO POR PESSOAS</p>
                        <p style="margin: 5px 0; font-size: 18px; font-weight: 900;">${tableOccupants} Pessoa(s)</p>
                        <p style="margin: 0; font-size: 20px; font-weight: 900;">R$ ${perPerson.toFixed(2)} p/ pessoa</p>
                    </div>

                    <div class="footer">
                        <p>DeliveryHub - Sistema de Gestão</p>
                        <p>*** NÃO É DOCUMENTO FISCAL ***</p>
                    </div>

                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const totalDiscounts = useMemo(() => {
        return Object.values(itemDiscounts).reduce((sum, v) => sum + v, 0);
    }, [itemDiscounts]);

    const applyDiscount = useCallback((key: string) => {
        const val = parseFloat(discountInput.replace(',', '.'));
        if (!isNaN(val) && val >= 0) {
            // Não pode abater mais do que o preço do item
            const item = tableItems.find(i => i.uniqueKey === key);
            if (item) {
                const max = item.finalPrice || (item.unitPrice * item.quantity);
                setItemDiscounts(prev => ({ ...prev, [key]: Math.min(val, max) }));
            }
        }
        setDiscountOpenKey(null);
        setDiscountInput('');
    }, [discountInput, tableItems]);

    const removeDiscount = useCallback((key: string) => {
        setItemDiscounts(prev => { const n = { ...prev }; delete n[key]; return n; });
    }, []);

    const totalPaid = useMemo(() => {
        return payments.reduce((sum, p) => sum + p.amount, 0);
    }, [payments]);

    const balanceRemaining = itemsToPayTotal - totalPaid;

    // Saldo em tempo real considerando o que está sendo digitado
    const typedAmount = parseFloat(newPaymentAmount.replace(',', '.')) || 0;
    const previewBalance = balanceRemaining - typedAmount;

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
            
            // Calcula o total real pago (com descontos aplicados)
            const totalPaidAmount = itemsToPayTotal;

            // Identify unique orders involved
            const ordersToProcess = new Set(itemsBeingPaid.map(i => i.orderId));
            let mainOrderId: string | undefined = undefined;
            
            for (const orderId of Array.from(ordersToProcess)) {
                const originalOrder = selectedTable.orders.find((o: Order) => o.id === orderId);
                if (!originalOrder) continue;
                if (!mainOrderId) mainOrderId = orderId;

                const itemsSelectedInThisOrder = itemsBeingPaid.filter(i => i.orderId === orderId);
                const itemsRemainingInThisOrder = (originalOrder.orderItems || []).filter((_: any, idx: number) => !selectedItemsKeys.has(`${orderId}-${idx}`));
                
                const orderRef = doc(firestore, `companies/${effectiveCompanyId}/orders`, orderId);
                
                if (itemsRemainingInThisOrder.length === 0) {
                    // SE TODOS OS ITENS DESTE PEDIDO FORAM PAGOS:
                    await updateDocument(orderRef, {
                        status: 'Entregue',
                        paymentMethod: paymentSummary,
                        payments: payments,
                        totalAmount: itemsSelectedInThisOrder.reduce((sum, i) => {
                            const base = i.finalPrice || (i.unitPrice * i.quantity);
                            const disc = itemDiscounts[i.uniqueKey] || 0;
                            return sum + Math.max(0, base - disc);
                        }, 0),
                        notes: (originalOrder.notes ? originalOrder.notes + " | " : "") + "Pagamentos: " + paymentSummary
                    });
                } else {
                    // SE APENAS ALGUNS ITENS DESTE PEDIDO FORAM PAGOS:
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
                            productName: item.productName || 'Produto',
                            quantity: item.quantity || 1,
                            unitPrice: item.unitPrice || 0,
                            finalPrice: item.finalPrice || (item.unitPrice * item.quantity),
                            notes: item.notes || '',
                            selectedVariants: item.selectedVariants || [],
                        })),
                        totalAmount: itemsSelectedInThisOrder.reduce((sum, i) => {
                            const base = i.finalPrice || (i.unitPrice * i.quantity);
                            const disc = itemDiscounts[i.uniqueKey] || 0;
                            return sum + Math.max(0, base - disc);
                        }, 0),
                        notes: "Pagamento Parcial da Mesa. Origem: " + orderId
                    });
                    mainOrderId = newOrderRef.id;

                    await updateDocument(doc(firestore, `companies/${effectiveCompanyId}/orders`, newOrderRef.id), {
                        status: 'Entregue'
                    });

                    const newTotal = itemsRemainingInThisOrder.reduce((sum: number, item: any) => sum + (item.finalPrice || (item.unitPrice * item.quantity)), 0);
                    await updateDocument(orderRef, {
                        orderItems: itemsRemainingInThisOrder,
                        totalAmount: newTotal
                    });
                }
            }

            // ── Registra venda no Caixa (se houver sessão aberta) ──
            try {
                if (payments && payments.length > 0) {
                    for (const p of payments) {
                        const result = await recordCashierSale(
                            firestore,
                            effectiveCompanyId,
                            p.amount,
                            `Mesa ${selectedTable.tableNumber} — ${p.method}`,
                            mainOrderId,
                            p.method
                        );

                        if (result && result.success && result.sessionId) {
                            const orderRef = doc(firestore, 'companies', effectiveCompanyId, 'orders', mainOrderId);
                            await updateDocument(orderRef, { sessionId: result.sessionId });
                        }
                    }
                } else {
                    await recordCashierSale(
                        firestore,
                        effectiveCompanyId,
                        totalPaidAmount,
                        `Mesa ${selectedTable.tableNumber} — ${paymentSummary}`,
                        mainOrderId,
                        paymentSummary
                    );
                }
            } catch (cashierError) {
                console.error('Error recording cashier sale:', cashierError);
            }

            toast({ title: "✅ Pagamento realizado!", description: `Mesa ${selectedTable.tableNumber} — R$ ${totalPaidAmount.toFixed(2)}. Redirecionando para o relatório...` });
            
            // Limpa contribuições da mesa
            await clearTableContributions(selectedTable.tableNumber);

            // Reset state
            setIsCheckoutMode(false);
            setSelectedItemsKeys(new Set());
            setPayments([]);
            setItemDiscounts({});
            setDiscountOpenKey(null);
            // Se a mesa ficou vazia (todos os itens pagos), removemos a reserva se existir
            if (selectedTable && effectiveCompanyId) {
                // Verificamos se ainda restam itens não pagos na mesa (além dos que acabamos de pagar)
                const remainingKeys = tableItems.filter(i => !selectedItemsKeys.has(i.uniqueKey));
                if (remainingKeys.length === 0) {
                    // Limpa metadados da mesa (nome do cliente e ocupantes) ao fechar totalmente
                    if (companyRef) {
                        try {
                            await updateDocument(companyRef, {
                                [`tableMetadata.${selectedTable.tableNumber}`]: {
                                    customerName: '',
                                    occupants: 1,
                                    updatedAt: serverTimestamp()
                                }
                            });
                        } catch (e) {
                            console.error("Erro ao limpar metadados da mesa:", e);
                        }
                    }

                    // Só tentamos cancelar a reserva se ela realmente existir (evita erro de permissão no Firestore)
                    if (selectedTable.isReserved) {
                        await handleCancelReservation(selectedTable.tableNumber, true);
                    }
                }
            }

            setSelectedTable(null);

            // Redireciona para o painel com o relatório de Fechamento de Caixa
            setTimeout(() => router.push('/dashboard'), 800);

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
            {/* ── Modal de Sangria Removido ── */}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Comandas (Mesas em Consumo)</h2>
                    <p className="text-muted-foreground">Monitore o consumo das mesas ativas no restaurante em tempo real.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {allTables.length > 0 && (
                        <div className="relative flex-1 sm:w-72">
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
                    {/* Sangria Button Removed */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2"
                        onClick={() => router.push('/dashboard/comandas/qrcodes')}
                    >
                        <Receipt className="h-4 w-4" />
                        <span className="hidden sm:inline">QR Codes</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() => setIsReserveDialogOpen(true)}
                    >
                        <Clock className="h-4 w-4" />
                        <span className="hidden sm:inline">Reservar Mesa</span>
                    </Button>
                </div>
            </div>

            {/* Banner de aviso se não há caixa aberto */}
            {!currentCashSession && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
                    <Banknote className="h-5 w-5 shrink-0" />
                    <span>
                        <strong>Caixa fechado.</strong> Os pagamentos feitos nas mesas não serão registrados no controle de caixa.
                        {' '}<button className="underline font-medium" onClick={() => router.push('/dashboard/cashier')}>Abrir Caixa →</button>
                    </span>
                </div>
            )}

            {allTables.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-24 bg-muted/10 border-dashed border-2 rounded-3xl">
                    <div className="bg-muted/20 p-6 rounded-full mb-6">
                        <Receipt className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">Nenhuma mesa configurada</h3>
                    <p className="text-muted-foreground mt-2 text-center max-w-sm px-6">
                        Configure o número de mesas em <strong>Configurações &gt; Empresa</strong> para começar a atender seus clientes.
                    </p>
                </Card>
            ) : filteredTables.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-24 bg-muted/10 border-dashed border-2 rounded-3xl">
                    <div className="bg-muted/20 p-6 rounded-full mb-6">
                        <Search className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">Nenhum resultado encontrado</h3>
                    <p className="text-muted-foreground mt-2 text-center max-w-sm px-6">
                        Não encontramos nenhuma mesa ou cliente que corresponda a "{searchQuery}".
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredTables.map((table) => {
                        if (table.isFree) {
                            return (
                                <Card 
                                    key={`free-${table.tableNumber}`} 
                                    className={cn(
                                        "group overflow-hidden transition-all duration-300 border-none shadow-md hover:shadow-xl hover:-translate-y-1 rounded-2xl",
                                        table.isReserved 
                                            ? "ring-1 ring-opacity-30" 
                                            : "bg-gradient-to-br from-emerald-50/50 to-emerald-100/20 ring-1 ring-emerald-100"
                                    )}
                                    style={table.isReserved ? { 
                                        backgroundColor: `${themeColors.accent}08`, 
                                        boxShadow: `0 0 0 1px ${themeColors.accent}33` 
                                    } : {}}
                                >
                                    <div 
                                        className={cn(
                                            "px-5 py-4 flex justify-between items-center transition-all duration-500 text-white"
                                        )}
                                        style={table.isReserved 
                                            ? { background: `linear-gradient(to right, ${themeColors.accent}, ${themeColors.accent}ee)` } 
                                            : { background: `linear-gradient(to right, #10b981, #14b8a6)` }
                                        }
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md text-white">
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <span className="font-bold text-lg tracking-tight">Mesa {table.tableNumber}</span>
                                        </div>
                                        <Badge className={cn(
                                            "border-none font-bold text-[10px] px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-inner",
                                            table.isReserved 
                                                ? "bg-white animate-pulse" 
                                                : "bg-white/20 text-white"
                                        )} style={table.isReserved ? { color: themeColors.accent } : {}}>
                                            {table.isReserved ? 'RESERVADA' : 'LIVRE'}
                                        </Badge>
                                    </div>
                                    <CardContent className="p-6 flex flex-col items-center justify-center min-h-[140px] space-y-4">
                                         {table.isReserved ? (
                                             <div className="text-center w-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                 <div className="space-y-1">
                                                     <p className="text-[10px] uppercase font-black tracking-[0.2em]" style={{ color: `${themeColors.accent}bb` }}>Cliente</p>
                                                     <p className="text-lg font-black leading-tight truncate px-2" style={{ color: themeColors.accent }}>{table.reservationName}</p>
                                                 </div>
                                                 <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs font-bold h-8 px-4 rounded-full" 
                                                    onClick={() => handleCancelReservation(table.tableNumber)}
                                                 >
                                                     Liberar Mesa
                                                 </Button>
                                             </div>
                                         ) : (
                                            <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 w-full flex flex-col items-center group-hover:bg-emerald-500/10 transition-colors">
                                                <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                                                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                                </div>
                                                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest">Pronta para uso</p>
                                            </div>
                                         )}
                                         <Button 
                                            className={cn(
                                                "w-full h-11 rounded-xl font-bold gap-2 transition-all duration-300 shadow-sm group-hover:shadow-md text-white"
                                            )}
                                            style={table.isReserved 
                                                ? { backgroundColor: themeColors.accent } 
                                                : { backgroundColor: '#10b981' }
                                            }
                                            onClick={() => router.push(`/waiter/${effectiveCompanyId}/dashboard/menu?table=${table.tableNumber}&admin=true`)}
                                         >
                                             <PlusCircle className="h-5 w-5" /> Abrir Comanda
                                         </Button>
                                    </CardContent>
                                </Card>
                            );
                        }

                        const oldestTime = table.oldestOrderTime || Date.now();
                        const minsOpen = Math.floor((Date.now() - oldestTime) / 60000);
                        const waitersArray = Array.from(table.waiters || []).filter(Boolean);
                        const customersArray = Array.from(table.customerNames || []).filter(Boolean);

                        return (
                            <Card 
                                key={table.tableNumber} 
                                className="group overflow-hidden transition-all duration-300 border-none shadow-md hover:shadow-xl hover:-translate-y-1 rounded-2xl cursor-pointer" 
                                style={{ 
                                    backgroundColor: `${themeColors.primary}08`, 
                                    boxShadow: `0 0 0 1px ${themeColors.primary}33` 
                                }}
                                onClick={() => setSelectedTable(table)}
                            >
                                <div 
                                    className="px-5 py-4 flex justify-between items-center text-white relative overflow-hidden"
                                    style={{ background: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.primary}ee)` }}
                                >
                                    {/* Glass reflection effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                                    
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                                            Mesa {table.tableNumber}
                                            {table.occupants > 1 && (
                                                <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Users className="w-2.5 h-2.5" /> {table.occupants}
                                                </span>
                                            )}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 relative z-10">
                                        {table.isReserved && (
                                            <Badge className="bg-white text-indigo-950 border-none text-[9px] h-5 px-2 font-black animate-pulse rounded-full shadow-lg" style={{ color: themeColors.primary }}>RESERVADA</Badge>
                                        )}
                                        <Badge className="bg-white/20 text-white border-none backdrop-blur-md px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                                            {table.orders.length} {table.orders.length === 1 ? 'Pedido' : 'Pedidos'}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-5 flex flex-col space-y-4">
                                    <div className="flex justify-between items-start pb-1">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2" style={{ color: themeColors.primary }}>
                                                <Clock className="h-4 w-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Há {minsOpen} min</span>
                                            </div>
                                            <p className={`text-sm font-black line-clamp-1 ${table.customerNameFromMeta ? '' : (customersArray.length > 0 ? '' : 'italic opacity-50')}`} style={{ color: themeColors.primary }}>
                                                {table.customerNameFromMeta || (customersArray.length > 0 ? customersArray.join(', ') : "Mesa em consumo")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-black tracking-widest leading-none mb-1 opacity-50" style={{ color: themeColors.primary }}>Total</p>
                                            <p className="text-2xl font-black tracking-tighter leading-none" style={{ color: themeColors.primary }}>
                                                <span className="text-xs font-bold mr-0.5">R$</span>{table.totalAmount.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: `${themeColors.primary}33` }}>
                                        {waitersArray.map((w: any) => (
                                            <Badge key={w} variant="secondary" className="border-none text-[9px] font-bold py-0 h-5" style={{ backgroundColor: `${themeColors.primary}15`, color: themeColors.primary }}>
                                                {w}
                                            </Badge>
                                        ))}
                                    </div>
                                    
                                    <div className="pt-1">
                                        <Button variant="outline" className="w-full h-10 rounded-xl font-bold text-xs transition-all" style={{ borderColor: `${themeColors.primary}88`, color: themeColors.primary }}>
                                            Gerenciar Mesa
                                        </Button>
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
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                        <DialogHeader className="p-6 pb-4 border-b bg-white relative">
                            <DialogTitle className="text-2xl flex flex-col sm:flex-row sm:justify-between sm:items-center pr-6 gap-2">
                                <div className="flex items-center gap-3">
                                    <span>Mesa {selectedTable.tableNumber}</span>
                                    {selectedTable.isReserved && (
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 pr-1 text-[10px] animate-in zoom-in-95">
                                            {selectedTable.reservationName}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-4 w-4 ml-1 hover:bg-amber-200 rounded-full" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelReservation(selectedTable.tableNumber);
                                                }}
                                                title="Cancelar Reserva"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-primary font-bold">R$ {selectedTable.totalAmount.toFixed(2)}</span>
                            </DialogTitle>
                        </DialogHeader>
                        
                        {/* Quick Table Settings (Occupants & Name) */}
                        <div className="bg-primary/5 border-b p-4 grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1">
                                    <User className="w-3 h-3" /> Nome do Cliente
                                </Label>
                                <Input 
                                    placeholder="Ex: João da Silva" 
                                    className="h-9 bg-white font-bold" 
                                    value={tableCustomerName} 
                                    onChange={(e) => setTableCustomerName(e.target.value)}
                                    onBlur={() => handleUpdateTableMetadata(tableCustomerName)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1">
                                    <Users className="w-3 h-3" /> Ocupantes
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-9 w-9 bg-white" onClick={() => {
                                        const n = Math.max(1, tableOccupants - 1);
                                        setTableOccupants(n);
                                        handleUpdateTableMetadata(undefined, n);
                                    }}><Minus className="h-4 w-4" /></Button>
                                    <Input 
                                        type="number" 
                                        className="h-9 bg-white text-center font-bold" 
                                        value={tableOccupants} 
                                        onChange={(e) => {
                                            const n = parseInt(e.target.value) || 1;
                                            setTableOccupants(n);
                                            handleUpdateTableMetadata(undefined, n);
                                        }}
                                    />
                                    <Button variant="outline" size="icon" className="h-9 w-9 bg-white" onClick={() => {
                                        const n = tableOccupants + 1;
                                        setTableOccupants(n);
                                        handleUpdateTableMetadata(undefined, n);
                                    }}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2">
                             {isCheckoutMode ? (
                                <div className="space-y-6">
                                     <div className="bg-muted/30 rounded-xl p-4 border border-primary/20">
                                        <div className="flex justify-between items-center mb-4 bg-primary/10 p-3 rounded-xl border border-primary/20">
                                            <div className="flex items-center gap-3">
                                                <Checkbox 
                                                    id="select-all-checkout"
                                                    checked={selectedItemsKeys.size === tableItems.length && tableItems.length > 0} 
                                                    onCheckedChange={selectAllItems}
                                                    className="h-5 w-5"
                                                />
                                                <Label htmlFor="select-all-checkout" className="font-bold text-sm cursor-pointer flex items-center gap-2">
                                                    <ShoppingBag className="w-4 h-4 text-primary" /> Selecionar Tudo ({tableItems.length} itens)
                                                </Label>
                                            </div>
                                            <Badge variant="outline" className="bg-background text-primary border-primary/20">
                                                {selectedItemsKeys.size} selecionados
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {tableItems.map((item) => {
                                                const basePrice = item.finalPrice || (item.unitPrice * item.quantity);
                                                const discount = itemDiscounts[item.uniqueKey] || 0;
                                                const finalPrice = Math.max(0, basePrice - discount);
                                                const isSelected = selectedItemsKeys.has(item.uniqueKey);
                                                const isDiscountOpen = discountOpenKey === item.uniqueKey;
                                                return (
                                                <div key={item.uniqueKey} className={`rounded-lg border transition-colors ${isSelected ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}>
                                                    <div className="p-3 flex items-start gap-3">
                                                        <Checkbox 
                                                            checked={isSelected} 
                                                            onCheckedChange={() => toggleItemSelection(item.uniqueKey)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between font-medium">
                                                                <span className="truncate">{formatQuantity(item.quantity, item.isSoldByWeight)} {item.productName}</span>
                                                                <span className={discount > 0 ? "text-muted-foreground line-through text-xs" : ""}>R$ {basePrice.toFixed(2)}</span>
                                                            </div>
                                                            {item.selectedVariants?.length > 0 && (
                                                                <p className="text-[10px] text-muted-foreground truncate">
                                                                    {item.selectedVariants.map((v: any) => v.itemName).join(', ')}
                                                                </p>
                                                            )}
                                                            {discount > 0 && (
                                                                <div className="flex justify-between items-center mt-1 text-emerald-600 font-bold">
                                                                    <span className="text-[10px] uppercase">Com Desconto:</span>
                                                                    <span>R$ {finalPrice.toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            {discount > 0 ? (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDiscount(item.uniqueKey)}><X className="h-3 w-3" /></Button>
                                                            ) : (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setDiscountOpenKey(item.uniqueKey)}><Tag className="h-3 w-3" /></Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {isDiscountOpen && (
                                                        <div className="px-3 pb-3 pt-1 border-t bg-primary/5 flex gap-2 animate-in slide-in-from-top-1">
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-2 top-2 text-[10px] font-bold text-primary">R$</span>
                                                                <Input 
                                                                    size={1}
                                                                    className="h-8 pl-6 text-xs" 
                                                                    placeholder="Valor do Abatimento" 
                                                                    value={discountInput}
                                                                    onChange={(e) => setDiscountInput(e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && applyDiscount(item.uniqueKey)}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <Button size="sm" className="h-8 px-3 text-xs" onClick={() => applyDiscount(item.uniqueKey)}>Aplicar</Button>
                                                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setDiscountOpenKey(null)}><X className="h-4 w-4" /></Button>
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="border-primary/20">
                                            <CardHeader className="py-3 px-4 bg-primary/5 border-b">
                                                <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> Pagamentos</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 space-y-4">
                                                <div className="flex gap-2">
                                                    <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                                                        <SelectTrigger className="flex-1 h-10"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                                            <SelectItem value="Pix">Pix</SelectItem>
                                                            <SelectItem value="Cartão de Crédito">Crédito</SelectItem>
                                                            <SelectItem value="Cartão de Débito">Débito</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <div className="relative w-32">
                                                        <span className="absolute left-2 top-2.5 text-xs text-muted-foreground font-bold">R$</span>
                                                        <Input 
                                                            className="h-10 pl-7 font-bold" 
                                                            placeholder="0,00"
                                                            value={newPaymentAmount}
                                                            onChange={(e) => setNewPaymentAmount(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                                                        />
                                                    </div>
                                                    <Button className="h-10 px-3" onClick={addPayment}><Plus className="w-4 h-4" /></Button>
                                                </div>

                                                <div className="space-y-2">
                                                    {payments.map((p, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm bg-muted/50 p-2 rounded-lg border">
                                                            <span className="font-medium">{p.method}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold">R$ {p.amount.toFixed(2)}</span>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removePayment(idx)}><Trash2 className="h-3 w-3" /></Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {payments.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum pagamento adicionado.</p>}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-primary/20 flex flex-col">
                                             <CardHeader className="py-3 px-4 bg-primary/5 border-b">
                                                <CardTitle className="text-sm flex items-center gap-2"><Calculator className="w-4 h-4" /> Resumo</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 flex-1 space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Itens Selecionados:</span>
                                                    <span className="font-bold">R$ {(itemsToPayTotal + totalDiscounts).toFixed(2)}</span>
                                                </div>
                                                {totalDiscounts > 0 && (
                                                    <div className="flex justify-between text-sm text-emerald-600 font-bold">
                                                        <span>Total Descontos:</span>
                                                        <span>- R$ {totalDiscounts.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <Separator />
                                                <div className="flex justify-between text-base font-black pt-1">
                                                    <span>Total a Pagar:</span>
                                                    <span className="text-primary text-xl">R$ {itemsToPayTotal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="text-muted-foreground">Total Pago:</span>
                                                    <span className="text-emerald-600">R$ {totalPaid.toFixed(2)}</span>
                                                </div>
                                                <Separator />
                                                <div className={`flex justify-between text-sm font-bold p-2 rounded-lg ${previewBalance <= 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    <span>{previewBalance <= 0.01 ? 'Troco:' : 'Falta Pagar:'}</span>
                                                    <span>R$ {Math.abs(previewBalance).toFixed(2)}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                             ) : (
                                <div className="space-y-6">
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 h-12 gap-2 shadow-sm" onClick={() => router.push(`/waiter/${effectiveCompanyId}/dashboard/menu?table=${selectedTable.tableNumber}&admin=true`)}>
                                            <PlusCircle className="h-5 w-5 text-primary" /> Lançar Itens
                                        </Button>
                                        <Button variant="outline" className="flex-1 h-12 gap-2 shadow-sm" onClick={() => setIsTransferDialogOpen(true)}>
                                            <HandCoins className="h-5 w-5 text-amber-600" /> Transferir Mesa
                                        </Button>
                                    </div>

                                    {/* ── Seção de Contribuições (Dinheiro na Mesa) ── */}
                                    <Card className="border-amber-200 bg-amber-50/30">
                                        <CardHeader className="py-3 px-4 border-b border-amber-100 flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                                                <Banknote className="h-4 w-4" /> Dinheiro na Mesa
                                            </CardTitle>
                                            {totalContributions > 0 && <Badge className="bg-amber-600">Acumulado: R$ {totalContributions.toFixed(2)}</Badge>}
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex gap-2">
                                                <Select value={contribMethod} onValueChange={setContribMethod}>
                                                    <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                                                        <SelectItem value="Pix">Pix</SelectItem>
                                                        <SelectItem value="Cartão">Cartão</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="relative flex-1">
                                                    <span className="absolute left-2 top-2.5 text-[10px] font-bold text-muted-foreground">R$</span>
                                                    <Input 
                                                        className="h-9 pl-6 text-sm font-bold" 
                                                        placeholder="Valor..." 
                                                        value={contribAmount}
                                                        onChange={(e) => setContribAmount(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddContribution()}
                                                    />
                                                </div>
                                                <Button size="sm" className="h-9 bg-amber-600 hover:bg-amber-700" onClick={handleAddContribution} disabled={isSavingContrib}>
                                                    {isSavingContrib ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            
                                            {tableContributions.length > 0 && (
                                                <div className="space-y-1.5">
                                                    {tableContributions.map((c) => (
                                                        <div key={c.id} className="flex justify-between items-center text-xs bg-white/50 p-2 rounded border border-amber-100">
                                                            <span className="font-medium">{c.method}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">R$ {c.amount.toFixed(2)}</span>
                                                                <button onClick={() => handleDeleteContribution(c.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-3 w-3" /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-3">
                                        <h3 className="font-bold flex items-center gap-2"><Receipt className="w-4 h-4" /> Itens Consumidos</h3>
                                        <div className="space-y-2">
                                            {tableItems.map((item) => (
                                                <div key={item.uniqueKey} className="flex justify-between items-start text-sm p-3 bg-muted/30 rounded-lg border border-border/50">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-primary">{formatQuantity(item.quantity, item.isSoldByWeight)}</span>
                                                            <span className="font-medium">{item.productName || item.productId}</span>
                                                        </div>
                                                        {item.selectedVariants?.length > 0 && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                {item.selectedVariants.map((v: any) => v.itemName).join(', ')}
                                                            </p>
                                                        )}
                                                        {item.notes && <p className="text-[10px] italic text-muted-foreground">Obs: {item.notes}</p>}
                                                        <p className="text-[9px] text-muted-foreground/60 uppercase mt-1">Lançado às {item.originalOrder.orderDate?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} por {item.originalOrder.waiterName || 'Sistema'}</p>
                                                    </div>
                                                    <span className="font-bold">R$ {(item.finalPrice || (item.unitPrice * item.quantity)).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {tableItems.length === 0 && (
                                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                                                    Mesa sem itens lançados.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                             )}
                        </div>

                        <DialogFooter className="p-6 pt-4 border-t bg-slate-50/50">
                            {isCheckoutMode ? (
                                <div className="flex flex-col sm:flex-row gap-3 w-full justify-between items-center">
                                    <Button variant="ghost" className="w-full sm:w-auto" onClick={() => { setIsCheckoutMode(false); setPayments([]); }}>Voltar aos Detalhes</Button>
                                    <Button className="h-12 px-8 text-lg font-bold shadow-lg w-full sm:w-auto" onClick={handleCheckout} disabled={balanceRemaining > 0.01}>
                                        Confirmar Pagamento
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                    <Button variant="outline" className="h-12 px-4 order-last sm:order-first" onClick={() => setSelectedTable(null)}>Fechar</Button>
                                    
                                    <div className="flex flex-wrap gap-2 flex-1 justify-end">
                                        <Button 
                                            variant="outline" 
                                            className="h-12 px-4 gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                            onClick={handlePrintConference}
                                        >
                                            <Printer className="h-4 w-4" />
                                            <span translate="no">Imprimir</span>
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            className="h-12 px-4 text-sm font-bold" 
                                            onClick={() => {
                                                setSelectedItemsKeys(new Set());
                                                setIsCheckoutMode(true);
                                            }} 
                                            disabled={tableItems.length === 0}
                                        >
                                            Pagamento Parcial
                                        </Button>
                                        <Button 
                                            className="h-12 px-5 text-sm font-bold shadow-lg bg-emerald-600 hover:bg-emerald-700 gap-2" 
                                            onClick={() => {
                                                setSelectedItemsKeys(new Set(tableItems.map(i => i.uniqueKey)));
                                                setIsCheckoutMode(true);
                                            }} 
                                            disabled={tableItems.length === 0}
                                        >
                                            <CheckCircle2 className="h-4 w-4" /> Fechar Completa
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Reserve Table Dialog */}
            <Dialog open={isReserveDialogOpen} onOpenChange={setIsReserveDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Reservar Mesa</DialogTitle>
                        <DialogDescription>Marque uma mesa como reservada para um cliente.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Número da Mesa</Label>
                            <Input placeholder="Ex: 5" value={reserveTableNum} onChange={(e) => setReserveTableNum(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome do Cliente</Label>
                            <Input placeholder="Ex: João Silva" value={reserveCustName} onChange={(e) => setReserveCustName(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReserveDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleReserveTable} disabled={isSavingReservation || !reserveTableNum || !reserveCustName}>
                            {isSavingReservation ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                            Confirmar Reserva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Table Dialog */}
            <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Transferir Consumo</DialogTitle>
                        <DialogDescription>Mova todos os itens da mesa {selectedTable?.tableNumber} para outra mesa.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Número da Mesa de Destino</Label>
                            <Input 
                                placeholder="Ex: 12" 
                                value={transferToTable} 
                                onChange={(e) => setTransferToTable(e.target.value)} 
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleTransferTable} disabled={isSavingTransfer || !transferToTable}>
                            {isSavingTransfer ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HandCoins className="h-4 w-4 mr-2" />}
                            Transferir Tudo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
