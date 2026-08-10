'use client';

import { useState, useMemo } from 'react';
import { 
    Search, Wallet, CheckCircle2, FileText, Calendar, User, DollarSign, ArrowRight, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocument, addDocument } from '@/firebase';
import { collection, query, where, doc, serverTimestamp, orderBy } from 'firebase/firestore';
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
import { recordCashierSale } from '@/lib/finance-utils';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type Receivable = {
    id: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerEmail: string;
    originalAmount: number;
    remainingAmount: number;
    status: 'pendente' | 'pago';
    dueDate: any;
    createdAt: any;
    originOrderId?: string;
    notes?: string;
};

export default function ReceivablesPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { isImpersonating, impersonatedCompanyId } = useImpersonation();
    const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('a_vencer');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
    
    // Pay Dialog State
    const [amountReceived, setAmountReceived] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [generateRemaining, setGenerateRemaining] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Refund State
    const [refundFromCashier, setRefundFromCashier] = useState(true);

    const receivablesRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return query(
            collection(firestore, `companies/${effectiveCompanyId}/receivables`)
        );
    }, [firestore, effectiveCompanyId]);

    const { data: receivablesData, isLoading } = useCollection<Receivable>(receivablesRef);

    const filteredReceivables = useMemo(() => {
        if (!receivablesData) return [];
        let filtered = receivablesData.filter(r => {
            const matchesSearch = r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (r.customerPhone && r.customerPhone.includes(searchQuery));
            if (!matchesSearch) return false;
            
            if (activeTab === 'vencidas') {
                const due = r.dueDate?.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
                if (r.status !== 'pendente' || due >= startOfDay(new Date())) return false;
            } else if (activeTab === 'a_vencer') {
                const due = r.dueDate?.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
                if (r.status !== 'pendente' || due < startOfDay(new Date())) return false;
            } else if (activeTab === 'quitadas') {
                if (r.status !== 'pago') return false;
            }

            if (dateRange?.from) {
                const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
                const toDate = dateRange.to || dateRange.from;
                if (!isWithinInterval(date, { start: startOfDay(dateRange.from), end: endOfDay(toDate) })) {
                    return false;
                }
            }
            return true;
        });

        // Sort by createdAt desc in memory to avoid requiring a composite index
        return filtered.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [receivablesData, searchQuery]);

    const totalPending = useMemo(() => {
        return filteredReceivables.reduce((acc, r) => acc + (r.remainingAmount || 0), 0);
    }, [filteredReceivables]);

    const openPayDialog = (receivable: Receivable) => {
        setSelectedReceivable(receivable);
        setAmountReceived(receivable.remainingAmount.toString());
        setPaymentMethod('Dinheiro');
        setGenerateRemaining(true);
        setIsPayDialogOpen(true);
    };

    const handlePay = async () => {
        if (!selectedReceivable || !firestore || !effectiveCompanyId) return;

        const received = parseFloat(amountReceived.replace(',', '.'));
        if (isNaN(received) || received <= 0) {
            toast({ variant: 'destructive', title: 'Valor Inválido', description: 'Informe um valor válido a ser recebido.' });
            return;
        }

        if (received > selectedReceivable.remainingAmount) {
            toast({ variant: 'destructive', title: 'Valor Excedente', description: 'O valor recebido não pode ser maior que o saldo devedor.' });
            return;
        }

        setIsSubmitting(true);

        try {
            const isPartial = received < selectedReceivable.remainingAmount;
            const diff = selectedReceivable.remainingAmount - received;

            const docRef = doc(firestore, `companies/${effectiveCompanyId}/receivables`, selectedReceivable.id);
            
            // 1. Marcar como pago
            await updateDocument(docRef, {
                status: 'pago',
                paidAt: serverTimestamp(),
                amountReceived: received,
                paidMethod: paymentMethod,
                discountGiven: isPartial && !generateRemaining ? diff : 0
            });

            // 2. Se for parcial e quiser gerar nova parcela
            if (isPartial && generateRemaining) {
                const receivablesCollection = collection(firestore, `companies/${effectiveCompanyId}/receivables`);
                await addDocument(receivablesCollection, {
                    companyId: effectiveCompanyId,
                    customerName: selectedReceivable.customerName,
                    customerPhone: selectedReceivable.customerPhone || '',
                    customerAddress: selectedReceivable.customerAddress || '',
                    customerEmail: selectedReceivable.customerEmail || '',
                    originalAmount: diff,
                    remainingAmount: diff,
                    status: 'pendente',
                    dueDate: selectedReceivable.dueDate, // Mantém o vencimento original ou adia?
                    createdAt: serverTimestamp(),
                    originOrderId: selectedReceivable.originOrderId || null,
                    notes: `Parcela restante gerada após pagamento parcial da conta original.`
                });
            }

            // 3. Registrar no caixa aberto
            const result = await recordCashierSale(
                firestore,
                effectiveCompanyId as string,
                received,
                `Recebimento de Fiado: ${selectedReceivable.customerName}`,
                undefined, // originOrderId não se aplica diretamente à venda do momento
                paymentMethod,
                'deposit'
            );

            if (result && result.success) {
                toast({
                    title: 'Sucesso',
                    description: isPartial 
                        ? (generateRemaining ? `Valor recebido e nova parcela de R$ ${diff.toFixed(2)} gerada.` : `Valor recebido com desconto de R$ ${diff.toFixed(2)}.`)
                        : 'Conta recebida e baixada com sucesso!',
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Baixado com aviso',
                    description: 'A conta foi baixada, mas não foi possível vincular ao caixa (verifique se há um caixa aberto).',
                });
            }

            setIsPayDialogOpen(false);
            setSelectedReceivable(null);
        } catch (error) {
            console.error('Erro ao baixar conta:', error);
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'Ocorreu um erro ao processar o pagamento.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isUserLoading) {
        return <div className="flex h-[80vh] items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    };

    const openRefundDialog = (receivable: Receivable) => {
        setSelectedReceivable(receivable);
        setRefundFromCashier(true);
        setIsRefundDialogOpen(true);
    };

    const handleRefund = async () => {
        if (!selectedReceivable || !firestore || !effectiveCompanyId) return;
        setIsSubmitting(true);

        try {
            const docRef = doc(firestore, `companies/${effectiveCompanyId}/receivables`, selectedReceivable.id);
            
            // 1. Reverter para pendente
            await updateDocument(docRef, {
                status: 'pendente',
                paidAt: null,
                amountReceived: null,
                paidMethod: null,
                discountGiven: null
            });

            // 2. Registrar estorno no caixa (saída de dinheiro, já que a quitação foi uma entrada)
            if (refundFromCashier) {
                await recordCashierSale(
                    firestore,
                    effectiveCompanyId as string,
                    selectedReceivable.amountReceived || selectedReceivable.remainingAmount,
                    `Estorno de Recebimento - ${selectedReceivable.customerName}`,
                    undefined,
                    selectedReceivable.paidMethod || 'Dinheiro',
                    'withdrawal'
                );
            }

            toast({ title: 'Estorno Realizado', description: 'A nota voltou para os pendentes com sucesso.' });
            setIsRefundDialogOpen(false);
            setSelectedReceivable(null);
        } catch (error) {
            console.error('Erro ao estornar:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao realizar estorno.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Wallet className="h-6 w-6" />
                        Contas a Receber (Crediário)
                    </h2>
                    <p className="text-muted-foreground">
                        Gerencie as contas pendentes e pagamentos de clientes (Fiado).
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">R$ {totalPending.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Nas {filteredReceivables.length} contas pendentes listadas.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-0 shadow-lg ring-1 ring-primary/5">
                <CardHeader className="border-b bg-muted/20 px-6 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="a_vencer">A Vencer</TabsTrigger>
                                <TabsTrigger value="vencidas">Vencidas</TabsTrigger>
                                <TabsTrigger value="quitadas">Quitadas</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar cliente por nome ou telefone..." 
                                className="pl-9 h-10 rounded-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                className={cn(
                                    "h-10 px-4 rounded-xl justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                )}
                                >
                                <Calendar className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
                                    </>
                                    ) : (
                                        format(dateRange.from, "dd/MM")
                                    )
                                ) : (
                                    <span>Filtrar Data</span>
                                )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <CalendarUI
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[60vh]">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredReceivables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="h-10 w-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Tudo em dia!</h3>
                                <p className="text-muted-foreground">Não há notas pendentes ou fiados para receber.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vencimento</th>
                                        <th className="px-4 py-3 font-medium text-muted-foreground w-32">Status</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredReceivables.map((receivable) => (
                                        <tr key={receivable.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                <div>{receivable.customerName}</div>
                                                <div className="flex gap-2 items-center text-xs text-muted-foreground mt-0.5">
                                                    {receivable.customerPhone && (
                                                        <span>{receivable.customerPhone}</span>
                                                    )}
                                                    {receivable.originOrderId && (
                                                        <span>• Venda #{receivable.originOrderId.substring(0, 6).toUpperCase()}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {receivable.dueDate ? format(receivable.dueDate?.toDate ? receivable.dueDate.toDate() : new Date(receivable.dueDate), 'dd/MM/yyyy') : 'N/A'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {receivable.status === 'pago' ? (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                                                    </Badge>
                                                ) : (
                                                    (receivable.dueDate?.toDate ? receivable.dueDate.toDate() : new Date(receivable.dueDate)) < startOfDay(new Date()) ? (
                                                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                                                            <AlertTriangle className="h-3 w-3 mr-1" /> Vencida
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                            <Calendar className="h-3 w-3 mr-1" /> Pendente
                                                        </Badge>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">
                                                R$ {(receivable.remainingAmount || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {receivable.status === 'pendente' && (
                                                    <Button size="sm" onClick={() => openPayDialog(receivable)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                                                        <DollarSign className="h-4 w-4 mr-1" /> Quitar
                                                    </Button>
                                                )}
                                                {receivable.status === 'pago' && (
                                                    <Button size="sm" variant="outline" onClick={() => openRefundDialog(receivable)} className="w-full text-rose-600 border-rose-200 hover:bg-rose-50">
                                                        Estornar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Pay Dialog */}
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Quitar Conta</DialogTitle>
                        <DialogDescription>
                            Registrar recebimento de {selectedReceivable?.customerName}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedReceivable && (
                        <div className="grid gap-6 py-4">
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 text-center">
                                <p className="text-sm text-muted-foreground mb-1">Saldo Devedor Atual</p>
                                <p className="text-3xl font-black text-primary">R$ {selectedReceivable.remainingAmount.toFixed(2)}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="amount-received" className="text-xs font-bold uppercase text-muted-foreground">Valor Recebido (R$)</Label>
                                    <Input
                                        id="amount-received"
                                        type="number"
                                        step="0.01"
                                        value={amountReceived}
                                        onChange={(e) => setAmountReceived(e.target.value)}
                                        className="h-12 text-lg text-center"
                                    />
                                </div>

                                {parseFloat(amountReceived || '0') < selectedReceivable.remainingAmount && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 space-y-4">
                                        <div className="flex gap-3">
                                            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                                            <div className="text-sm text-yellow-800 dark:text-yellow-200 leading-tight">
                                                <strong>Pagamento Parcial detectado.</strong><br/>
                                                O valor é menor que o saldo devedor. Restará R$ {(selectedReceivable.remainingAmount - parseFloat(amountReceived || '0')).toFixed(2)}.
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between bg-white dark:bg-black/20 p-3 rounded border">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm">Gerar nova parcela?</Label>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Se inativo, o restante será dado como desconto.
                                                </p>
                                            </div>
                                            <Switch 
                                                checked={generateRemaining}
                                                onCheckedChange={setGenerateRemaining}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Forma de Pagamento</Label>
                                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
                                        <Label
                                            className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'Dinheiro' ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:bg-accent'}`}
                                        >
                                            <RadioGroupItem value="Dinheiro" className="sr-only" />
                                            <span className="font-semibold text-sm">Dinheiro</span>
                                        </Label>
                                        <Label
                                            className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'PIX' ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:bg-accent'}`}
                                        >
                                            <RadioGroupItem value="PIX" className="sr-only" />
                                            <span className="font-semibold text-sm">PIX</span>
                                        </Label>
                                        <Label
                                            className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'Cartão de Crédito' ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:bg-accent'}`}
                                        >
                                            <RadioGroupItem value="Cartão de Crédito" className="sr-only" />
                                            <span className="font-semibold text-sm">C. Crédito</span>
                                        </Label>
                                        <Label
                                            className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${paymentMethod === 'Cartão de Débito' ? 'border-primary bg-primary/5 text-primary' : 'border-muted hover:bg-accent'}`}
                                        >
                                            <RadioGroupItem value="Cartão de Débito" className="sr-only" />
                                            <span className="font-semibold text-sm">C. Débito</span>
                                        </Label>
                                    </RadioGroup>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsPayDialogOpen(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handlePay} disabled={isSubmitting || !amountReceived} className="font-bold">
                            {isSubmitting ? 'Processando...' : 'Confirmar Recebimento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refund Dialog */}
            <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Estornar Recebimento</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja estornar o recebimento de {selectedReceivable?.customerName}?
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedReceivable && (
                        <div className="grid gap-6 py-4">
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
                                <p className="text-sm text-rose-800 font-medium">Atenção!</p>
                                <p className="text-xs text-rose-600 mt-1">
                                    Isso fará com que a nota volte para a lista de pendentes. 
                                    {selectedReceivable.amountReceived && ` O valor de R$ ${selectedReceivable.amountReceived.toFixed(2)} recebido será desconsiderado.`}
                                </p>
                            </div>

                            <div className="flex items-center justify-between bg-muted/20 p-4 rounded-xl border">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold">Estornar também do Caixa?</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Se marcado, será registrada uma saída (sangria) no valor recebido.
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
