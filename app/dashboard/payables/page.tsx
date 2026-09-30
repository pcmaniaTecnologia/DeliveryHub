'use client';

import { useState, useMemo } from 'react';
import { 
    Search, CreditCard, CheckCircle2, Calendar, DollarSign, Plus, XCircle, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocument, addDocument } from '@/firebase';
import { collection, query, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useImpersonation } from '@/context/impersonation-context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { recordCashierSale } from '@/lib/finance-utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

type Payable = {
    id: string;
    description: string;
    amount: number;
    category: string;
    status: 'pendente' | 'pago';
    dueDate: any;
    createdAt: any;
    paidAt?: any;
    paidMethod?: string;
    notes?: string;
};

const CATEGORIES = [
    'Fornecedor',
    'Água / Luz / Internet',
    'Funcionário',
    'Aluguel',
    'Imposto',
    'Outros'
];

export default function PayablesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { isImpersonating, impersonatedCompanyId } = useImpersonation();
    const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

    const [activeTab, setActiveTab] = useState('a_vencer');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    // Novo Lançamento
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newDescription, setNewDescription] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
    const [newNotes, setNewNotes] = useState('');

    // Baixa (Pagamento)
    const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [deductFromCashier, setDeductFromCashier] = useState(false);
    const [refundFromCashier, setRefundFromCashier] = useState(false);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Queries
    const payablesRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return query(
            collection(firestore, `companies/${effectiveCompanyId}/payables`)
        );
    }, [firestore, effectiveCompanyId]);

    const { data: allPayables, isLoading } = useCollection<Payable>(payablesRef);

    const filteredPayables = useMemo(() => {
        if (!allPayables) return [];
        const today = startOfDay(new Date());

        const toDate = (value: any): Date | null => {
            if (!value) return null;
            const parsed = value?.toDate ? value.toDate() : new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const parseInputDate = (value: string): Date | null => {
            if (!value) return null;
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
        };

        const rangeStart = parseInputDate(dateFrom);
        const rangeEnd = parseInputDate(dateTo);

        let filtered = allPayables.filter(payable => {
            const matchesSearch = payable.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                payable.category.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;

            const dueDate = toDate(payable.dueDate);

            if (activeTab === 'vencidas') {
                if (payable.status !== 'pendente' || !dueDate || dueDate >= today) return false;
            } else if (activeTab === 'a_vencer') {
                if (payable.status !== 'pendente' || !dueDate || dueDate < today) return false;
            } else if (activeTab === 'quitadas' && payable.status !== 'pago') {
                return false;
            }

            if (rangeStart || rangeEnd) {
                const referenceDate = activeTab === 'quitadas'
                    ? toDate(payable.paidAt) || toDate(payable.createdAt)
                    : dueDate;
                if (!referenceDate) return false;

                const intervalStart = startOfDay(rangeStart || rangeEnd!);
                const intervalEnd = endOfDay(rangeEnd || rangeStart!);
                const start = intervalStart <= intervalEnd ? intervalStart : startOfDay(intervalEnd);
                const end = intervalStart <= intervalEnd ? intervalEnd : endOfDay(intervalStart);

                if (!isWithinInterval(referenceDate, { start, end })) return false;
            }

            return true;
        });

        return filtered.sort((a, b) => {
            const timeA = a.dueDate?.toMillis?.() || (new Date(a.dueDate).getTime()) || 0;
            const timeB = b.dueDate?.toMillis?.() || (new Date(b.dueDate).getTime()) || 0;
            return (activeTab === 'a_vencer' || activeTab === 'vencidas') ? timeA - timeB : timeB - timeA;
        });
    }, [allPayables, searchQuery, activeTab, dateFrom, dateTo]);

    const filteredTotal = useMemo(() => {
        return filteredPayables.reduce((acc, payable) => acc + (payable.amount || 0), 0);
    }, [filteredPayables]);

    const tabCounts = useMemo(() => {
        const today = startOfDay(new Date());
        return (allPayables || []).reduce((counts, payable) => {
            if (payable.status === 'pago') {
                counts.quitadas += 1;
                return counts;
            }

            const dueDate = payable.dueDate?.toDate
                ? payable.dueDate.toDate()
                : payable.dueDate ? new Date(payable.dueDate) : null;

            if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate < today) {
                counts.vencidas += 1;
            } else {
                counts.a_vencer += 1;
            }
            return counts;
        }, { a_vencer: 0, vencidas: 0, quitadas: 0 });
    }, [allPayables]);

    // Lógica para criar
    const handleAddPayable = async () => {
        if (!firestore || !effectiveCompanyId) return;
        
        const amt = parseFloat(newAmount.replace(',', '.'));
        if (!newDescription.trim() || isNaN(amt) || amt <= 0 || !newDueDate) {
            toast({ variant: 'destructive', title: 'Campos Inválidos', description: 'Preencha todos os campos obrigatórios corretamente.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const dateParts = newDueDate.split('-');
            const dueDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);

            const docData = {
                description: newDescription.trim(),
                amount: amt,
                category: newCategory,
                status: 'pendente',
                dueDate: dueDate,
                createdAt: serverTimestamp(),
                notes: newNotes.trim()
            };

            await addDocument(collection(firestore, `companies/${effectiveCompanyId}/payables`), docData);
            
            toast({ title: 'Sucesso', description: 'Despesa lançada com sucesso!' });
            setIsAddDialogOpen(false);
            setNewDescription('');
            setNewAmount('');
            setNewDueDate('');
            setNewNotes('');
            setNewCategory(CATEGORIES[0]);
        } catch (error) {
            console.error('Erro ao adicionar:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao lançar despesa.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Lógica para quitar
    const openPayDialog = (payable: Payable) => {
        setSelectedPayable(payable);
        setPaymentMethod('Dinheiro');
        setDeductFromCashier(false);
        setIsPayDialogOpen(true);
    };

    const handlePay = async () => {
        if (!selectedPayable || !firestore || !effectiveCompanyId) return;

        setIsSubmitting(true);
        try {
            const docRef = doc(firestore, `companies/${effectiveCompanyId}/payables`, selectedPayable.id);
            
            await updateDocument(docRef, {
                status: 'pago',
                paidAt: serverTimestamp(),
                paidMethod: paymentMethod,
                deductedFromCashier: deductFromCashier
            });

            if (deductFromCashier) {
                const result = await recordCashierSale(
                    firestore,
                    effectiveCompanyId as string,
                    selectedPayable.amount,
                    `Pagamento de Despesa: ${selectedPayable.description}`,
                    undefined,
                    paymentMethod,
                    'withdrawal'
                );

                if (!result || !result.success) {
                    toast({
                        variant: 'destructive',
                        title: 'Aviso de Caixa',
                        description: 'A conta foi baixada, mas não havia caixa aberto para registrar a saída (Sangria).',
                    });
                } else {
                    toast({ title: 'Sucesso', description: 'Conta paga e sangria registrada no caixa!' });
                }
            } else {
                toast({ title: 'Sucesso', description: 'Conta baixada com sucesso!' });
            }

            setIsPayDialogOpen(false);
            setSelectedPayable(null);
        } catch (error) {
            console.error('Erro ao baixar conta:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao processar pagamento.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openRefundDialog = (payable: Payable) => {
        setSelectedPayable(payable);
        setRefundFromCashier(!!(payable as any).deductedFromCashier);
        setIsRefundDialogOpen(true);
    };

    const handleRefund = async () => {
        if (!selectedPayable || !firestore || !effectiveCompanyId) return;

        setIsSubmitting(true);
        try {
            const docRef = doc(firestore, `companies/${effectiveCompanyId}/payables`, selectedPayable.id);
            
            await updateDocument(docRef, {
                status: 'pendente',
                paidAt: null,
                paidMethod: null,
                deductedFromCashier: null
            });

            if (refundFromCashier) {
                const result = await recordCashierSale(
                    firestore,
                    effectiveCompanyId as string,
                    selectedPayable.amount,
                    `Estorno de Pagamento: ${selectedPayable.description}`,
                    undefined,
                    selectedPayable.paidMethod || 'Dinheiro',
                    'deposit'
                );

                if (!result || !result.success) {
                    toast({
                        variant: 'destructive',
                        title: 'Aviso de Caixa',
                        description: 'A conta foi estornada, mas não havia caixa aberto para registrar a entrada de devolução.',
                    });
                } else {
                    toast({ title: 'Sucesso', description: 'Conta estornada e devolução registrada no caixa!' });
                }
            } else {
                toast({ title: 'Sucesso', description: 'Conta estornada com sucesso!' });
            }

            setIsRefundDialogOpen(false);
            setSelectedPayable(null);
        } catch (error) {
            console.error('Erro ao estornar conta:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao processar estorno.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore || !effectiveCompanyId) return;
        if (confirm("Tem certeza que deseja excluir este lançamento?")) {
            try {
                await deleteDoc(doc(firestore, `companies/${effectiveCompanyId}/payables`, id));
                toast({ title: 'Excluído', description: 'Lançamento removido.' });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao excluir.' });
            }
        }
    };

    if (isUserLoading) {
        return <div className="flex h-[80vh] items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    return (
        <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <CreditCard className="h-6 w-6" />
                        Contas a Pagar (Despesas)
                    </h2>
                    <p className="text-muted-foreground">
                        Controle suas contas de luz, aluguel, fornecedores e lançamentos de saída.
                    </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 shadow-sm">
                    <Plus className="h-4 w-4" /> Nova Despesa
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-rose-500/5 border-rose-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-rose-700">
                            {activeTab === 'quitadas' ? 'Total pago' : activeTab === 'vencidas' ? 'Total vencido' : 'Total a pagar'}
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-rose-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">R$ {filteredTotal.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            {filteredPayables.length} {filteredPayables.length === 1 ? 'conta listada' : 'contas listadas'}.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-0 shadow-lg ring-1 ring-primary/5">
                <CardHeader className="border-b bg-muted/20 px-6 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="a_vencer" className="gap-1.5">
                                    A vencer <span className="rounded-full bg-background/80 px-1.5 text-[10px] tabular-nums">{tabCounts.a_vencer}</span>
                                </TabsTrigger>
                                <TabsTrigger value="vencidas" className="gap-1.5">
                                    Vencidas <span className="rounded-full bg-background/80 px-1.5 text-[10px] tabular-nums">{tabCounts.vencidas}</span>
                                </TabsTrigger>
                                <TabsTrigger value="quitadas" className="gap-1.5">
                                    Quitadas <span className="rounded-full bg-background/80 px-1.5 text-[10px] tabular-nums">{tabCounts.quitadas}</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        
                        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
                            <div className="relative min-w-0 flex-1 lg:w-72">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por descrição ou categoria" 
                                    className="h-10 rounded-xl pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2 rounded-xl border bg-background p-2 sm:flex-row sm:items-end">
                                <div className="grid flex-1 grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="payable-date-from" className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            De
                                        </Label>
                                        <Input
                                            id="payable-date-from"
                                            type="date"
                                            value={dateFrom}
                                            max={dateTo || undefined}
                                            onChange={(event) => setDateFrom(event.target.value)}
                                            className="h-9 min-w-0 rounded-lg px-2 text-xs sm:w-36"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="payable-date-to" className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Até
                                        </Label>
                                        <Input
                                            id="payable-date-to"
                                            type="date"
                                            value={dateTo}
                                            min={dateFrom || undefined}
                                            onChange={(event) => setDateTo(event.target.value)}
                                            className="h-9 min-w-0 rounded-lg px-2 text-xs sm:w-36"
                                        />
                                    </div>
                                </div>
                                {(dateFrom || dateTo) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-3 text-xs"
                                        onClick={() => {
                                            setDateFrom('');
                                            setDateTo('');
                                        }}
                                    >
                                        Limpar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[60vh]">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredPayables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="h-10 w-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">
                                    {activeTab === 'quitadas' ? 'Nenhuma conta quitada' : activeTab === 'vencidas' ? 'Tudo em dia!' : 'Nenhuma conta a vencer'}
                                </h3>
                                <p className="text-muted-foreground">
                                    {dateFrom || dateTo || searchQuery
                                        ? 'Nenhum resultado encontrado com os filtros informados.'
                                        : activeTab === 'quitadas'
                                            ? 'Os pagamentos concluídos aparecerão aqui.'
                                            : activeTab === 'vencidas'
                                                ? 'Não há despesas vencidas no momento.'
                                                : 'Não há despesas pendentes com vencimento futuro.'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredPayables.map((payable) => (
                                    <div key={payable.id} className="p-4 sm:px-6 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-base">{payable.description}</span>
                                                <Badge variant="outline">{payable.category}</Badge>
                                                {payable.status === 'pendente' && (
                                                    (payable.dueDate?.toDate ? payable.dueDate.toDate() : new Date(payable.dueDate)) < startOfDay(new Date()) ? (
                                                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                                                            <XCircle className="h-3 w-3 mr-1" /> Vencida
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                            <Calendar className="h-3 w-3 mr-1" /> A Vencer
                                                        </Badge>
                                                    )
                                                )}
                                                {payable.status === 'pago' && (
                                                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                        Pago
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5" /> 
                                                    Vencimento: {payable.dueDate?.toDate ? payable.dueDate.toDate().toLocaleDateString('pt-BR') : new Date(payable.dueDate).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            {payable.notes && (
                                                <p className="text-sm text-muted-foreground italic mt-1">{payable.notes}</p>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 mt-2 sm:mt-0">
                                            <span className="font-bold text-lg text-foreground">
                                                R$ {payable.amount.toFixed(2)}
                                            </span>
                                            
                                            <div className="flex sm:flex-col gap-2 shrink-0">
                                                {payable.status === 'pendente' && (
                                                    <Button onClick={() => openPayDialog(payable)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Baixar
                                                    </Button>
                                                )}
                                                {payable.status === 'pago' && (
                                                    <Button variant="outline" onClick={() => openRefundDialog(payable)} size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50">
                                                        Estornar
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-600 border-rose-100" onClick={() => handleDelete(payable.id)}>
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Dialog Nova Despesa */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Nova Despesa</DialogTitle>
                        <DialogDescription>
                            Preencha os dados do lançamento para o contas a pagar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input 
                                placeholder="Ex: Conta de Luz, Aluguel, Fornecedor de Embalagens..."
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input 
                                    type="number"
                                    placeholder="0.00"
                                    value={newAmount}
                                    onChange={(e) => setNewAmount(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Vencimento</Label>
                                <Input 
                                    type="date"
                                    value={newDueDate}
                                    onChange={(e) => setNewDueDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map(cat => (
                                    <Button 
                                        key={cat}
                                        type="button"
                                        variant={newCategory === cat ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setNewCategory(cat)}
                                        className="h-8 justify-start text-xs"
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Observações (Opcional)</Label>
                            <Input 
                                placeholder="Detalhes adicionais..."
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handleAddPayable} disabled={isSubmitting}>
                            {isSubmitting ? 'Salvando...' : 'Lançar Despesa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Pagamento */}
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Quitar Despesa</DialogTitle>
                        <DialogDescription>
                            Confirme o pagamento de <strong className="text-foreground">{selectedPayable?.description}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="bg-muted p-4 rounded-lg flex items-center justify-between border">
                            <span className="font-semibold text-muted-foreground">Valor a Pagar:</span>
                            <span className="text-2xl font-bold text-foreground">R$ {selectedPayable?.amount.toFixed(2)}</span>
                        </div>

                        <div className="space-y-3">
                            <Label>Como foi feito o pagamento?</Label>
                            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
                                {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Transferência'].map((method) => (
                                    <div key={method} className="flex items-center space-x-2">
                                        <RadioGroupItem value={method} id={`pay-${method}`} />
                                        <Label htmlFor={`pay-${method}`} className="cursor-pointer font-normal">{method}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg shadow-sm bg-background">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Descontar do Caixa Atual?</Label>
                                <p className="text-xs text-muted-foreground">Gera uma Sangria (saída) automática no caixa</p>
                            </div>
                            <Switch 
                                checked={deductFromCashier}
                                onCheckedChange={setDeductFromCashier}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPayDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button onClick={handlePay} disabled={isSubmitting}>
                            {isSubmitting ? 'Processando...' : 'Confirmar Pagamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refund Dialog */}
            <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Estornar Pagamento</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja estornar o pagamento de "{selectedPayable?.description}"?
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedPayable && (
                        <div className="grid gap-6 py-4">
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                                <p className="text-sm text-rose-800 font-medium">Atenção!</p>
                                <p className="text-xs text-rose-600 mt-1">
                                    A conta voltará para o status "Pendente" com vencimento original.
                                </p>
                            </div>

                            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold">Devolver valor ao Caixa?</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Se marcado, registrará uma entrada no caixa no valor de R$ {selectedPayable.amount.toFixed(2)}.
                                    </p>
                                </div>
                                <Switch 
                                    checked={refundFromCashier}
                                    onCheckedChange={setRefundFromCashier}
                                />
                            </div>

                            <DialogFooter className="mt-4 gap-2 sm:gap-0">
                                <Button type="button" variant="outline" onClick={() => setIsRefundDialogOpen(false)} disabled={isSubmitting}>
                                    Cancelar
                                </Button>
                                <Button type="button" onClick={handleRefund} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                                    {isSubmitting ? 'Estornando...' : 'Confirmar Estorno'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
