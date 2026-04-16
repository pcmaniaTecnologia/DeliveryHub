'use client';

import React, { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, updateDocument, useDoc } from '@/firebase';
import { useImpersonation } from '@/context/impersonation-context';
import { collection, doc, query, where, orderBy, type Timestamp, serverTimestamp, limit } from 'firebase/firestore';
import { isWithinInterval, format, startOfDay, endOfDay, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { ptBR } from 'date-fns/locale';
import { parseSalesByPaymentMethod } from '@/lib/finance-utils';
import { Calendar as CalendarIcon, FilterX } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Banknote, ArrowDownCircle, ArrowUpCircle, History, Calculator, CheckCircle2, XCircle, Printer, PieChart, Landmark, CreditCard, DollarSign, Plus } from 'lucide-react';

type CashSession = {
  id: string;
  status: 'open' | 'closed';
  openedAt: Timestamp;
  openedBy: string;
  openingBalance: number;
  closedAt?: Timestamp;
  closedBy?: string;
  closingBalanceExpected?: number;
  closingBalanceActual?: number;
  totalWithdrawals: number;
  totalSales: number;
  note?: string;
};

type CashTransaction = {
  id: string;
  sessionId: string;
  type: 'opening' | 'withdrawal' | 'deposit' | 'sale' | 'closing';
  amount: number;
  description: string;
  timestamp: Timestamp;
  orderId?: string;
  paymentMethod?: string;
};

export default function CashierPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isImpersonating, impersonatedCompanyId } = useImpersonation();
  const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

  const [isOpening, setIsOpening] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('0');
  
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [transactionType, setTransactionType] = useState<'withdrawal' | 'deposit'>('withdrawal');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDesc, setTransactionDesc] = useState('');

  const [isClosing, setIsClosing] = useState(false);
  const [closingActual, setClosingActual] = useState('');
  const [closingNote, setClosingNote] = useState('');

  // Date Filter State
  const [activePreset, setActivePreset] = useState<'session' | 'today' | 'yesterday' | 'week' | 'month' | null>('session');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const handlePresetChange = (preset: 'session' | 'today' | 'yesterday' | 'week' | 'month') => {
    setActivePreset(preset);
    if (preset === 'session') {
      setDateRange(undefined);
      return;
    }

    const now = new Date();
    let fromDate: Date;
    let toDate: Date = endOfDay(now);

    switch(preset) {
        case 'yesterday':
            fromDate = startOfDay(subDays(now, 1));
            toDate = endOfDay(subDays(now, 1));
            break;
        case 'week':
            fromDate = startOfDay(subDays(now, 6));
            break;
        case 'month':
            fromDate = startOfDay(subDays(now, 29));
            break;
        case 'today':
        default:
            fromDate = startOfDay(now);
            break;
    }
    setDateRange({ from: fromDate, to: toDate });
  };

  // Fetch Open Session
  const openSessionRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    return query(
      collection(firestore, `companies/${effectiveCompanyId}/cashier_sessions`),
      where('status', '==', 'open'),
      limit(1)
    );
  }, [firestore, effectiveCompanyId]);

  const { data: currentSessions, isLoading: isLoadingSession } = useCollection<CashSession>(openSessionRef);
  const currentSession = currentSessions?.[0];

  // Fetch Transactions (for current session OR date range)
  const transactionsRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    let collRef = collection(firestore, `companies/${effectiveCompanyId}/cashier_transactions`);
    
    // Se estivermos vendo apenas a sessão atual, filtramos pelo ID dela
    if (activePreset === 'session' && currentSession?.id) {
       return query(collRef, where('sessionId', '==', currentSession.id));
    }

    // Caso contrário, buscamos tudo e filtramos na memória para evitar índices complexos
    return query(collRef);
  }, [firestore, user?.uid, currentSession?.id, activePreset]);

  const { data: rawTransactions } = useCollection<CashTransaction>(transactionsRef);

  const transactions = useMemo(() => {
    if (!rawTransactions) return null;
    
    let filtered = rawTransactions;

    if (activePreset !== 'session' && dateRange?.from) {
      const from = startOfDay(dateRange.from).getTime();
      const to = (dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)).getTime();
      
      filtered = rawTransactions.filter(t => {
        const time = t.timestamp?.toMillis?.() || 0;
        return time >= from && time <= to;
      });
    }

    return [...filtered].sort((a, b) => {
      const getTime = (ts: any) => {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts instanceof Date) return ts.getTime();
        if (typeof ts === 'number') return ts;
        return 0;
      };
      return getTime(b.timestamp) - getTime(a.timestamp);
    });
  }, [rawTransactions, dateRange, activePreset]);

  const sessionOrderIds = useMemo(() => {
    if (!transactions) return new Set<string>();
    return new Set(
        transactions
            .filter(t => t.type === 'sale' && t.orderId)
            .map(t => t.orderId)
    );
  }, [transactions]);

  // Fetch Orders for the Current Session period
  const ordersRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    return collection(firestore, `companies/${effectiveCompanyId}/orders`);
  }, [firestore, effectiveCompanyId]);

  const { data: rawOrders } = useCollection<any>(ordersRef);

  const salesByPaymentMethod = useMemo(() => {
    if (!rawOrders) return { cash: 0, pix: 0, credit: 0, debit: 0 };
    
    let start: Date;
    let end: Date;

    if (activePreset === 'session' && currentSession) {
      // Defensive check for pending server timestamps
      if (!currentSession.openedAt) return { cash: 0, pix: 0, credit: 0, debit: 0 };
      
      start = currentSession.openedAt.toDate();
      end = currentSession.closedAt?.toDate?.() || new Date();
    } else if (dateRange?.from) {
      start = startOfDay(dateRange.from);
      end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    } else {
      return { cash: 0, pix: 0, credit: 0, debit: 0 };
    }

    const sessionOrders = rawOrders.filter(order => {
      if (order.status === 'Cancelado') return false;
      
      // 1. Priority: Direct Session ID match OR Transaction Cross-Reference
      if (activePreset === 'session' && currentSession?.id) {
        if ((order as any).sessionId === currentSession.id || sessionOrderIds.has(order.id)) {
            return true;
        }
      }

      // 2. Fallback: Time-based matching
      const orderDate = order.orderDate;
      let date: Date;

      if (!orderDate) {
        date = new Date();
      } else if (orderDate && typeof orderDate.toDate === 'function') {
        date = orderDate.toDate();
      } else if (orderDate instanceof Date) {
        date = orderDate;
      } else if (typeof orderDate === 'number') {
        date = new Date(orderDate);
      } else {
        date = new Date();
      }

      return isWithinInterval(date, { start, end });
    });

    return parseSalesByPaymentMethod(sessionOrders);
  }, [rawOrders, currentSession, dateRange, activePreset, sessionOrderIds]);

  const sessionTotalSales = useMemo(() => {
    // Caso o retorno venha como Array (formato antigo/gráfico)
    if (Array.isArray(salesByPaymentMethod)) {
      return (salesByPaymentMethod as any[]).reduce((sum, item) => sum + (item.value || 0), 0);
    }
    
    // Caso venha como Objeto (formato novo/caixa)
    const s = salesByPaymentMethod as any;
    return (s.cash || 0) + (s.pix || 0) + (s.credit || 0) + (s.debit || 0);
  }, [salesByPaymentMethod]);

  const handlePrintReport = () => {
    let start: Date | null = null;
    let end: Date | null = null;
    let title = "Fechamento de Caixa";

    if (activePreset === 'session' && currentSession?.openedAt) {
      start = currentSession.openedAt.toDate();
      end = currentSession.closedAt?.toDate?.() || new Date();
    } else if (dateRange?.from) {
      start = startOfDay(dateRange.from);
      end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      title = "Relatório de Vendas (Filtrado)";
    }

    if (!start) {
      toast({ variant: 'destructive', title: 'Dados insuficientes', description: 'Não há dados para imprimir neste período.' });
      return;
    }

    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const startStr = format(start, "dd/MM/yyyy HH:mm");
    const endStr = end ? format(end, "dd/MM/yyyy HH:mm") : 'Em aberto';

    const printHtml = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            h2, h3 { text-align: center; margin-bottom: 5px; }
            .meta { text-align: center; font-size: 0.9em; color: #666; margin-bottom: 20px; }
            .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #ccc; }
            .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 1.25em; padding-top: 15px; border-top: 2px solid #000; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>Fechamento de Caixa</h2>
          <div class="meta">Período: ${startStr} - ${endStr}</div>
          
          <div class="item"><span>Dinheiro</span> <span>${formatCurrency(salesByPaymentMethod.cash)}</span></div>
          <div class="item"><span>PIX</span> <span>${formatCurrency(salesByPaymentMethod.pix)}</span></div>
          <div class="item"><span>Cartão de Crédito</span> <span>${formatCurrency(salesByPaymentMethod.credit)}</span></div>
          <div class="item"><span>Cartão de Débito</span> <span>${formatCurrency(salesByPaymentMethod.debit)}</span></div>
          
          <div class="total"><span>Total</span> <span>${formatCurrency(sessionTotalSales)}</span></div>

          <script>
            window.print();
            window.onafterprint = () => window.close();
          </script>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  };

  // Fetch Session History
  const historyRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, `companies/${user.uid}/cashier_sessions`),
      where('status', '==', 'closed'),
      limit(10)
    );
  }, [firestore, user?.uid]);

  const { data: rawHistory } = useCollection<CashSession>(historyRef);

  const history = useMemo(() => {
    if (!rawHistory) return null;
    return [...rawHistory].sort((a, b) => {
      const getTime = (ts: any) => {
        if (!ts) return 0;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts instanceof Date) return ts.getTime();
        return 0;
      };
      return getTime(b.openedAt) - getTime(a.openedAt);
    });
  }, [rawHistory]);

  const stats = useMemo(() => {
    const opening = currentSession?.openingBalance || 0;
    if (!transactions) return { withdrawals: 0, deposits: 0, sales: 0, current: opening };
    
    let withdrawals = 0;
    let deposits = 0;
    let sales = 0;

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'withdrawal') withdrawals += amt;
      if (t.type === 'deposit') deposits += amt;
      if (t.type === 'sale') sales += amt;
    });

    const current = Number(opening) + deposits + sales - withdrawals;

    const result = { 
      withdrawals: Number(withdrawals.toFixed(2)), 
      deposits: Number(deposits.toFixed(2)), 
      sales: Number(sales.toFixed(2)), 
      current: Number(current.toFixed(2)) 
    };

    console.log('Cashier State:', { 
      sessionId: currentSession?.id, 
      transactionsCount: transactions?.length,
      stats: result
    });

    return result;
  }, [transactions, currentSession]);

  const handleOpenCashier = async () => {
    if (!firestore || !user) return;
    setIsOpening(true);
    try {
      const balance = parseFloat(openingBalance) || 0;
      const sessionRef = collection(firestore, `companies/${effectiveCompanyId}/cashier_sessions`);
      
      const sessionData = {
        status: 'open',
        openedAt: serverTimestamp(),
        openedBy: user.uid,
        openingBalance: balance,
        totalWithdrawals: 0,
        totalSales: 0
      };

      const newSession = await addDocument(sessionRef, sessionData);

      // Add initial transaction
      const transRef = collection(firestore, `companies/${effectiveCompanyId}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: newSession.id,
        type: 'opening',
        amount: balance,
        description: 'Abertura de Caixa (Troco Inicial)',
        timestamp: serverTimestamp()
      });

      toast({ title: 'Caixa Aberto!', description: `Caixa iniciado com R$ ${balance.toFixed(2)}` });
      setOpeningBalance('0');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao abrir caixa', description: 'Tente novamente mais tarde.' });
    } finally {
      setIsOpening(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!firestore || !user || !currentSession) return;
    const amount = parseFloat(transactionAmount);
    if (!amount || amount <= 0) return;

    try {
      const transRef = collection(firestore, `companies/${effectiveCompanyId}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: currentSession.id,
        type: transactionType,
        amount,
        description: transactionDesc || (transactionType === 'withdrawal' ? 'Retirada Manual' : 'Reforço de Caixa'),
        timestamp: serverTimestamp()
      });

      // Update session totals if it's a withdrawal
      if (transactionType === 'withdrawal') {
        const sessDocRef = doc(firestore, `companies/${effectiveCompanyId}/cashier_sessions`, currentSession.id);
        await updateDocument(sessDocRef, {
            totalWithdrawals: (currentSession.totalWithdrawals || 0) + amount
        });
      }

      toast({ 
        title: transactionType === 'withdrawal' ? 'Saída Registrada' : 'Entrada Registrada', 
        description: `Valor: R$ ${amount.toFixed(2)}` 
      });
      setIsAddingTransaction(false);
      setTransactionAmount('');
      setTransactionDesc('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao registrar', description: 'Não foi possível salvar a movimentação.' });
    }
  };

  const handleCloseCashier = async () => {
    if (!firestore || !user || !currentSession) return;
    try {
      const actual = parseFloat(closingActual) || 0;
      const sessDocRef = doc(firestore, `companies/${effectiveCompanyId}/cashier_sessions`, currentSession.id);
      
      await updateDocument(sessDocRef, {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: user.uid,
        closingBalanceExpected: stats.current,
        closingBalanceActual: actual,
        note: closingNote
      });

      // Add closing transaction for history
      const transRef = collection(firestore, `companies/${effectiveCompanyId}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: currentSession.id,
        type: 'closing',
        amount: actual,
        description: 'Fechamento de Caixa',
        timestamp: serverTimestamp()
      });

      toast({ title: 'Caixa Fechado!', description: `Saldo final conferido: R$ ${actual.toFixed(2)}` });
      setIsClosing(false);
      setClosingActual('');
      setClosingNote('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao fechar caixa', description: 'Tente novamente.' });
    }
  };

  if (isLoadingSession) return <div className="p-8 text-center">Carregando informações do caixa...</div>;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header & Filter Bar */}
      <div className="flex flex-col gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Controle de Caixa</h2>
            {currentSession && activePreset === 'session' && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 px-3 py-1 flex gap-2">
                <CheckCircle2 className="h-4 w-4" /> Caixa Aberto
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Gerencie suas sessões e acompanhe as movimentações financeiras em tempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5 rounded-xl border shadow-sm">
          <Button 
            variant={activePreset === 'session' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handlePresetChange('session')}
            className={cn("h-9 px-4 rounded-lg transition-all", activePreset === 'session' && "shadow-sm")}
          >
            Sessão Atual
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button 
            variant={activePreset === 'today' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handlePresetChange('today')}
            className={cn("h-9 px-4 rounded-lg", activePreset === 'today' && "shadow-sm")}
          >
            Hoje
          </Button>
          <Button 
            variant={activePreset === 'yesterday' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => handlePresetChange('yesterday')}
            className={cn("h-9 px-4 rounded-lg", activePreset === 'yesterday' && "shadow-sm")}
          >
            Ontem
          </Button>

          <Popover>
            <PopoverTrigger asChild>
                <Button
                variant={activePreset === null ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                    "h-9 px-4 rounded-lg justify-start text-left font-normal",
                    !dateRange && activePreset !== null && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
                    </>
                    ) : (
                        format(dateRange.from, "dd/MM")
                    )
                ) : (
                    <span>Período</span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                    if (range) {
                        setDateRange(range);
                        setActivePreset(null);
                    }
                }}
                numberOfMonths={2}
                locale={ptBR}
                />
            </PopoverContent>
          </Popover>

          {(dateRange || activePreset !== 'session') && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handlePresetChange('session')}
              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
              title="Limpar Filtro"
            >
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!currentSession && activePreset === 'session' ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
              <Banknote className="h-6 w-6" />
            </div>
            <CardTitle>Nenhuma sessão de caixa aberta</CardTitle>
            <CardDescription className="max-w-sm mx-auto">
              Abra uma nova sessão de caixa para começar a registrar vendas de balcão e movimentações manuais.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-md mx-auto pb-10 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Troco Inicial (Fundo de Caixa)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                <Input 
                  id="openingBalance" 
                  type="number" 
                  className="pl-9 text-lg"
                  value={openingBalance} 
                  onChange={(e) => setOpeningBalance(e.target.value)} 
                  placeholder="0.00"
                />
              </div>
            </div>
            <Button className="w-full h-11 text-lg shadow-lg" onClick={handleOpenCashier} disabled={isOpening}>
              {isOpening ? 'Abrindo...' : 'Abrir Caixa Agora'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {/* Top Summary Cards */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-70">
                  {activePreset === 'session' ? 'Saldo Atual (Gaveta)' : 'Saldo no Período'}
                </CardTitle>
                <Calculator className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">R$ {stats.current.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                {activePreset === 'session' && currentSession ? (
                    <p className="text-xs text-muted-foreground mt-1">Iniciado com R$ {currentSession.openingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                ) : (
                    <p className="text-xs text-muted-foreground mt-1">Soma de entradas e saídas</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-70">Vendas no Caixa</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">+ R$ {stats.sales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Total acumulado em vendas</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-rose-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-70">Saídas (Sangrias)</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-rose-600">- R$ {stats.withdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Retiradas manuais realizadas</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-70">Reforços de Caixa</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">+ R$ {stats.deposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground mt-1">Entradas manuais realizadas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-7 items-start">
            {/* Payment Methods Breakdown Card */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                          <PieChart className="h-5 w-5 text-primary" />
                          Fechamento por Pagamento
                      </CardTitle>
                      <CardDescription>
                          {activePreset === 'session' ? 'Dados da sessão atual.' : 'Dados do período selecionado.'}
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-4">
                          {[
                            { label: 'Dinheiro', value: salesByPaymentMethod.cash, icon: Banknote },
                            { label: 'PIX', value: salesByPaymentMethod.pix, icon: Landmark },
                            { label: 'Cartão de Crédito', value: salesByPaymentMethod.credit, icon: CreditCard },
                            { label: 'Cartão de Débito', value: salesByPaymentMethod.debit, icon: CreditCard },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center group">
                                <item.icon className="h-5 w-5 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="flex-1 text-sm font-medium">{item.label}</span>
                                <span className="font-semibold">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                      </div>
                  </CardContent>
                  <CardFooter className="flex-col items-stretch space-y-3 pt-6">
                      <Separator />
                      <div className="flex items-center font-bold text-xl pt-2 text-primary">
                          <DollarSign className="h-6 w-6 mr-3" />
                          <span className="flex-1">Total Vendido</span>
                          <span>R$ {sessionTotalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <Button variant="outline" className="w-full bg-white hover:bg-muted font-semibold shadow-sm h-11" onClick={handlePrintReport}>
                          <Printer className="mr-2 h-4 w-4" />
                          Imprimir Relatório
                      </Button>
                  </CardFooter>
              </Card>

              {/* Recent Closed Sessions */}
              <Card className="shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30">
                  <CardTitle className="flex gap-2 items-center text-sm"><History className="h-4 w-4 text-muted-foreground" /> Sessões Recentes</CardTitle>
                </CardHeader>
                <div className="divide-y overflow-y-auto max-h-[300px]">
                    {!history || history.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Historico vazio.</div>
                    ) : (
                    history.map(s => (
                        <div key={s.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold">{s.openedAt?.toDate ? format(s.openedAt.toDate(), "dd 'de' MMMM", { locale: ptBR }) : 'Data...'}</span>
                            <div className="flex gap-4 text-xs text-muted-foreground font-medium">
                                <span>Abertura: <b>R$ {s.openingBalance.toFixed(2)}</b></span>
                                <span>Contado: <b>R$ {s.closingBalanceActual?.toFixed(2)}</b></span>
                            </div>
                        </div>
                        <Badge variant={Math.abs((s.closingBalanceActual || 0) - (s.closingBalanceExpected || 0)) < 0.1 ? 'outline' : 'destructive'} className="text-[10px] h-6 px-2">
                            {Math.abs((s.closingBalanceActual || 0) - (s.closingBalanceExpected || 0)) < 0.1 ? 'Conferido' : `Dif: R$ ${(s.closingBalanceActual! - s.closingBalanceExpected!).toFixed(2)}`}
                        </Badge>
                        </div>
                    ))
                    )}
                </div>
              </Card>
            </div>

            {/* Transactions History Card */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-muted-foreground" /> Movimentações</CardTitle>
                    <CardDescription>Entradas, saídas e vendas detalhadas.</CardDescription>
                  </div>
                  
                  {activePreset === 'session' && currentSession && (
                    <div className="flex gap-2">
                    <Dialog open={isAddingTransaction} onOpenChange={setIsAddingTransaction}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-9 shadow-sm"><Plus className="mr-2 h-4 w-4" /> Sangria / Reforço</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle>Registrar Movimentação</DialogTitle>
                                <DialogDescription>Adicione uma entrada ou saída manual no saldo do caixa.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="flex gap-2 p-1 bg-muted rounded-lg shadow-inner">
                                <Button 
                                    className="flex-1 rounded-md" 
                                    size="sm"
                                    variant={transactionType === 'withdrawal' ? 'default' : 'ghost'} 
                                    onClick={() => setTransactionType('withdrawal')}
                                >Sangria (Saída)</Button>
                                <Button 
                                    className="flex-1 rounded-md" 
                                    size="sm"
                                    variant={transactionType === 'deposit' ? 'default' : 'ghost'} 
                                    onClick={() => setTransactionType('deposit')}
                                >Reforço (Entrada)</Button>
                                </div>
                                <div className="space-y-2">
                                <Label>Valor</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                                    <Input 
                                        type="number" 
                                        className="pl-9"
                                        placeholder="0.00" 
                                        value={transactionAmount} 
                                        onChange={(e) => setTransactionAmount(e.target.value)} 
                                    />
                                </div>
                                </div>
                                <div className="space-y-2">
                                <Label>Descrição / Motivo</Label>
                                <Input 
                                    placeholder="Ex: Compra de gelo, motoboy..." 
                                    value={transactionDesc} 
                                    onChange={(e) => setTransactionDesc(e.target.value)} 
                                />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddingTransaction(false)}>Cancelar</Button>
                                <Button onClick={handleAddTransaction}>Confirmar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                    <Dialog open={isClosing} onOpenChange={setIsClosing}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="h-9 shadow-sm"><XCircle className="mr-2 h-4 w-4" /> Fechar Caixa</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                                <DialogTitle>Fechamento de Caixa</DialogTitle>
                                <DialogDescription>Confirme o valor físico presente na gaveta.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="bg-muted/50 p-5 rounded-xl space-y-3 border shadow-sm">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Troco Inicial:</span>
                                        <span className="font-medium">R$ {currentSession.openingBalance.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                        <span>Vendas + Reforços:</span>
                                        <span>+ R$ {(stats.sales + stats.deposits).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-rose-600 font-medium">
                                        <span>Sangrias:</span>
                                        <span>- R$ {stats.withdrawals.toFixed(2)}</span>
                                    </div>
                                    <Separator className="bg-muted-foreground/20" />
                                    <div className="flex justify-between font-bold text-xl items-end">
                                        <span className="text-base font-semibold">Saldo Esperado:</span>
                                        <span>R$ {stats.current.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-base">Valor contado na gaveta (R$)</Label>
                                    <Input 
                                        type="number" 
                                        className="text-xl h-12 font-bold"
                                        placeholder="0.00" 
                                        value={closingActual} 
                                        onChange={(e) => setClosingActual(e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Observações</Label>
                                    <Input value={closingNote} onChange={(e) => setClosingNote(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsClosing(false)}>Cancelar</Button>
                                <Button variant="destructive" className="h-11 px-8 font-bold shadow-lg" onClick={handleCloseCashier}>Encerrar Sessão</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[100px] pl-6">Horário</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Espécie</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!transactions || transactions.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-16">
                                <div className="flex flex-col items-center gap-3">
                                    <FilterX className="h-10 w-10 opacity-20" />
                                    <p>Nenhuma movimentação para exibir.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map(t => (
                          <TableRow key={t.id} className="group transition-colors hover:bg-muted/30">
                            <TableCell className="text-xs font-medium pl-6 text-muted-foreground">
                                {t.timestamp?.toDate ? format(t.timestamp.toDate(), 'HH:mm') : '--:--'}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={cn(
                                    "font-semibold text-[10px] uppercase tracking-tighter px-2 py-0 border-transparent",
                                    t.type === 'withdrawal' && "text-rose-600 bg-rose-50", 
                                    t.type === 'deposit' && "text-blue-600 bg-blue-50", 
                                    t.type === 'opening' && "text-amber-600 bg-amber-50",
                                    t.type === 'sale' && "text-emerald-600 bg-emerald-50"
                                )}
                              >
                                {t.type === 'withdrawal' ? 'Sangria' : 
                                 t.type === 'deposit' ? 'Reforço' : 
                                 t.type === 'opening' ? 'Abertura' : 'Venda'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                                {t.description}
                            </TableCell>
                            <TableCell className={cn(
                                "text-right font-bold pr-6 whitespace-nowrap",
                                t.type === 'withdrawal' ? 'text-rose-600' : 'text-emerald-600'
                            )}>
                              {t.type === 'withdrawal' ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
