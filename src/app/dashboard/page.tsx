'use client';

import {
  Banknote, CreditCard, DollarSign, Package, PieChart, Landmark,
  ShoppingCart, Users, Calendar as CalendarIcon, Printer, ShieldCheck,
  ArrowDownCircle, ArrowUpCircle, XCircle, Loader2, Lock
} from 'lucide-react';
import Link from 'next/link';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  useUser, useFirestore, useCollection, useMemoFirebase, useDoc,
  addDocument, updateDocument,
} from '@/firebase';
import { collection, query, where, limit, doc, type Timestamp, serverTimestamp } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  customerId: string;
  orderDate: Timestamp;
  status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
  totalAmount: number;
  paymentMethod: string;
  customerName?: string;
};

type SalesByPaymentMethod = {
  cash: number;
  pix: number;
  credit: number;
  debit: number;
};

type CashSession = {
  id: string;
  status: string;
  openingBalance: number;
  totalWithdrawals?: number;
  openedAt: Timestamp;
};

const chartConfig = {
  sales: { label: 'Vendas', color: 'hsl(var(--primary))' },
};

// ─── Sub-component ───────────────────────────────────────────────────────────

function RecentOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map(order => (
          <TableRow key={order.id}>
            <TableCell>
              <div className="font-medium">{order.customerName || 'Cliente Anônimo'}</div>
              <div className="hidden text-sm text-muted-foreground md:inline">{order.customerId.substring(0, 10)}...</div>
            </TableCell>
            <TableCell>
              <Badge variant={order.status === 'Cancelado' ? 'destructive' : 'default'} className="whitespace-nowrap">
                {order.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              R${order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // ── Orders ──────────────────────────────────────────────────────────────
  const ordersRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, `companies/${user.uid}/orders`);
  }, [firestore, user?.uid]);
  const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);

  // ── Admin Check ─────────────────────────────────────────────────────────
  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user?.uid]);
  const { data: adminData, isLoading: isLoadingAdmin } = useDoc(adminRef);

  // ── Cashier Session ─────────────────────────────────────────────────────
  const openSessionRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, `companies/${user.uid}/cashier_sessions`),
      where('status', '==', 'open'),
      limit(1)
    );
  }, [firestore, user?.uid]);
  const { data: openSessions } = useCollection<CashSession>(openSessionRef);
  const currentCashSession = openSessions?.[0] ?? null;

  // ── Modal State: Sangria ────────────────────────────────────────────────
  const [isSangriaOpen, setIsSangriaOpen] = useState(false);
  const [sangriaAmount, setSangriaAmount] = useState('');
  const [sangriaDesc, setSangriaDesc] = useState('');
  const [isSavingSangria, setIsSavingSangria] = useState(false);

  // ── Modal State: Suprimento ─────────────────────────────────────────────
  const [isSuprimentoOpen, setIsSuprimentoOpen] = useState(false);
  const [suprimentoAmount, setSuprimentoAmount] = useState('');
  const [suprimentoDesc, setSuprimentoDesc] = useState('');
  const [isSavingSuprimento, setIsSavingSuprimento] = useState(false);

  // ── Modal State: Fechar Caixa ───────────────────────────────────────────
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [closingActual, setClosingActual] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [isSavingClose, setIsSavingClose] = useState(false);

  // ── Date Filter ─────────────────────────────────────────────────────────
  const [activePreset, setActivePreset] = useState<'today' | 'week' | 'month' | null>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const handlePresetChange = (preset: 'today' | 'week' | 'month') => {
    setActivePreset(preset);
    const now = new Date();
    let fromDate: Date;
    switch (preset) {
      case 'week': fromDate = startOfDay(subDays(now, 6)); break;
      case 'month': fromDate = startOfDay(subDays(now, 29)); break;
      default: fromDate = startOfDay(now); break;
    }
    setDateRange({ from: fromDate, to: endOfDay(now) });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range) {
      setDateRange({
        from: range.from ? startOfDay(range.from) : undefined,
        to: range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined,
      });
      setActivePreset(null);
    }
  };

  // ── Cashier Handlers ────────────────────────────────────────────────────

  const handleSangria = async () => {
    const amount = parseFloat(sangriaAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || !firestore || !user?.uid || !currentCashSession) return;
    setIsSavingSangria(true);
    try {
      const transRef = collection(firestore, `companies/${user.uid}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: currentCashSession.id,
        type: 'withdrawal',
        amount,
        description: sangriaDesc.trim() || 'Sangria de Caixa',
        timestamp: serverTimestamp(),
      });
      const sessDocRef = doc(firestore, `companies/${user.uid}/cashier_sessions`, currentCashSession.id);
      await updateDocument(sessDocRef, {
        totalWithdrawals: (currentCashSession.totalWithdrawals || 0) + amount,
      });
      toast({ title: '✅ Sangria registrada!', description: `R$ ${amount.toFixed(2)} retirado do caixa.` });
      setSangriaAmount(''); setSangriaDesc(''); setIsSangriaOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao registrar sangria' });
    }
    setIsSavingSangria(false);
  };

  const handleSuprimento = async () => {
    const amount = parseFloat(suprimentoAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0 || !firestore || !user?.uid || !currentCashSession) return;
    setIsSavingSuprimento(true);
    try {
      const transRef = collection(firestore, `companies/${user.uid}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: currentCashSession.id,
        type: 'deposit',
        amount,
        description: suprimentoDesc.trim() || 'Suprimento de Caixa',
        timestamp: serverTimestamp(),
      });
      toast({ title: '✅ Suprimento registrado!', description: `R$ ${amount.toFixed(2)} adicionado ao caixa.` });
      setSuprimentoAmount(''); setSuprimentoDesc(''); setIsSuprimentoOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao registrar suprimento' });
    }
    setIsSavingSuprimento(false);
  };

  const handleCloseCashier = async () => {
    if (!firestore || !user?.uid || !currentCashSession) return;
    setIsSavingClose(true);
    try {
      const actual = parseFloat(closingActual) || 0;
      const sessDocRef = doc(firestore, `companies/${user.uid}/cashier_sessions`, currentCashSession.id);
      await updateDocument(sessDocRef, {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: user.uid,
        closingBalanceActual: actual,
        note: closingNote,
      });
      const transRef = collection(firestore, `companies/${user.uid}/cashier_transactions`);
      await addDocument(transRef, {
        sessionId: currentCashSession.id,
        type: 'closing',
        amount: actual,
        description: 'Fechamento de Caixa',
        timestamp: serverTimestamp(),
      });
      toast({ title: '🔒 Caixa Fechado!', description: `Saldo conferido: R$ ${actual.toFixed(2)}` });
      setClosingActual(''); setClosingNote(''); setIsCloseOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao fechar caixa' });
    }
    setIsSavingClose(false);
  };

  // ── Data Calculations ───────────────────────────────────────────────────

  const {
    totalSales, totalOrders, avgTicket, pendingOrders,
    salesChartData, recentOrdersWithDetails, salesByPaymentMethod,
  } = useMemo(() => {
    const empty = {
      totalSales: 0, totalOrders: 0, avgTicket: 0, pendingOrders: 0,
      salesChartData: [], recentOrdersWithDetails: [],
      salesByPaymentMethod: { cash: 0, pix: 0, credit: 0, debit: 0 },
    };
    if (!orders) return empty;

    const filteredOrders = orders.filter(order => {
      if (!dateRange?.from) return false;
      const orderDate = order.orderDate.toDate();
      const toDate = dateRange.to || dateRange.from;
      return isWithinInterval(orderDate, { start: dateRange.from, end: toDate });
    });

    const successfulOrders = filteredOrders.filter(o => o.status !== 'Cancelado');
    const totalSales = successfulOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = successfulOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    const pendingOrders = orders.filter(o =>
      ['Novo', 'Aguardando pagamento', 'Em preparo'].includes(o.status)
    ).length;

    const salesByPaymentMethod = successfulOrders.reduce<SalesByPaymentMethod>((acc, order) => {
      const methods = order.paymentMethod.split(', ');
      const orderTotal = order.totalAmount;
      const methodsWithValues = methods.map(m => {
        const matchTroco = m.match(/(.+) \(troco para R\$\s*([\d,.]+)\)/);
        if (matchTroco) return { method: matchTroco[1].trim(), amount: orderTotal };
        const matchVal = m.match(/(.+) \(R\$\s*([\d,.]+)\)/);
        if (matchVal) return { method: matchVal[1].trim(), amount: parseFloat(matchVal[2].replace(',', '.')) };
        return { method: m.trim(), amount: null };
      });
      if (methodsWithValues.length === 1 && methodsWithValues[0].amount === null) {
        const sm = methodsWithValues[0].method.toLowerCase();
        if (sm.includes('dinheiro')) acc.cash += orderTotal;
        else if (sm.includes('pix')) acc.pix += orderTotal;
        else if (sm.includes('crédito')) acc.credit += orderTotal;
        else if (sm.includes('débito')) acc.debit += orderTotal;
      } else {
        methodsWithValues.forEach(({ method, amount }) => {
          const ml = method.toLowerCase();
          const v = amount || 0;
          if (ml.includes('dinheiro')) acc.cash += v;
          else if (ml.includes('pix')) acc.pix += v;
          else if (ml.includes('crédito')) acc.credit += v;
          else if (ml.includes('débito')) acc.debit += v;
        });
      }
      return acc;
    }, { cash: 0, pix: 0, credit: 0, debit: 0 });

    const salesChartData = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const daySales = orders
        .filter(o => isWithinInterval(o.orderDate.toDate(), { start: dayStart, end: dayEnd }) && o.status !== 'Cancelado')
        .reduce((s, o) => s + o.totalAmount, 0);
      return { date: format(date, 'dd/MM', { locale: ptBR }), Vendas: daySales };
    }).reverse();

    const recentOrdersWithDetails = [...orders]
      .sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime())
      .slice(0, 5);

    return { totalSales, totalOrders, avgTicket, pendingOrders, salesChartData, recentOrdersWithDetails, salesByPaymentMethod };
  }, [orders, dateRange]);

  const isLoading = isUserLoading || isLoadingOrders || isLoadingAdmin;

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return '';
    const from = format(dateRange.from, 'P', { locale: ptBR });
    const to = dateRange.to ? format(dateRange.to, 'P', { locale: ptBR }) : from;
    return from === to ? `(${from})` : `(${from} — ${to})`;
  }, [dateRange]);

  const handlePrint = () => {
    const fc = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const html = `<html><head><title>Fechamento de Caixa</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}h2,h3{text-align:center}
      .item{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #ccc}
      .total{display:flex;justify-content:space-between;font-weight:bold;font-size:1.2em;padding-top:10px;border-top:2px solid #000}
      </style></head><body>
      <h2>Fechamento de Caixa</h2><h3>${dateRangeLabel.replace(/[()]/g, '')}</h3>
      <div class="item"><span>Dinheiro</span><span>${fc(salesByPaymentMethod.cash)}</span></div>
      <div class="item"><span>PIX</span><span>${fc(salesByPaymentMethod.pix)}</span></div>
      <div class="item"><span>Cartão de Crédito</span><span>${fc(salesByPaymentMethod.credit)}</span></div>
      <div class="item"><span>Cartão de Débito</span><span>${fc(salesByPaymentMethod.debit)}</span></div>
      <div class="total"><span>Total</span><span>${fc(totalSales)}</span></div>
      <script>window.print();window.onafterprint=()=>window.close();</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><p>Carregando painel...</p></div>;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ══════════ MODAL: SANGRIA ══════════ */}
      <Dialog open={isSangriaOpen} onOpenChange={setIsSangriaOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-rose-500" /> Sangria de Caixa
            </DialogTitle>
            <DialogDescription>Registre uma retirada de dinheiro do caixa físico.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Valor da Sangria</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                <Input type="number" className="pl-9 text-lg font-bold" placeholder="0.00"
                  value={sangriaAmount} onChange={e => setSangriaAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSangria()} autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input placeholder="Ex: Pagamento fornecedor, troco..." value={sangriaDesc}
                onChange={e => setSangriaDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSangria()} />
            </div>
            {!currentCashSession && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Abra o caixa primeiro em <strong>Controle de Caixa</strong>.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSangriaOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSangria} disabled={isSavingSangria || !sangriaAmount || !currentCashSession}>
              {isSavingSangria ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownCircle className="h-4 w-4 mr-2" />}
              Confirmar Sangria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ MODAL: SUPRIMENTO ══════════ */}
      <Dialog open={isSuprimentoOpen} onOpenChange={setIsSuprimentoOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-emerald-500" /> Suprimento de Caixa
            </DialogTitle>
            <DialogDescription>Registre uma entrada de dinheiro no caixa (reforço).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Valor do Suprimento</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                <Input type="number" className="pl-9 text-lg font-bold" placeholder="0.00"
                  value={suprimentoAmount} onChange={e => setSuprimentoAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSuprimento()} autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Troco inicial, reforço..." value={suprimentoDesc}
                onChange={e => setSuprimentoDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSuprimento()} />
            </div>
            {!currentCashSession && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Abra o caixa primeiro em <strong>Controle de Caixa</strong>.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSuprimentoOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSuprimento}
              disabled={isSavingSuprimento || !suprimentoAmount || !currentCashSession}>
              {isSavingSuprimento ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpCircle className="h-4 w-4 mr-2" />}
              Confirmar Suprimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ MODAL: FECHAR CAIXA ══════════ */}
      <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" /> Fechamento de Caixa
            </DialogTitle>
            <DialogDescription>Informe o valor físico contado na gaveta para encerrar a sessão.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Resumo de vendas */}
            <div className="bg-muted/50 p-4 rounded-xl border space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Resumo do Período {dateRangeLabel}
              </p>
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />Dinheiro:</span>
                <span className="font-semibold text-right">R$ {salesByPaymentMethod.cash.toFixed(2)}</span>
                <span className="text-muted-foreground flex items-center gap-1"><Landmark className="h-3.5 w-3.5" />PIX:</span>
                <span className="font-semibold text-right">R$ {salesByPaymentMethod.pix.toFixed(2)}</span>
                <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" />Crédito:</span>
                <span className="font-semibold text-right">R$ {salesByPaymentMethod.credit.toFixed(2)}</span>
                <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" />Débito:</span>
                <span className="font-semibold text-right">R$ {salesByPaymentMethod.debit.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total Vendido:</span>
                <span className="text-primary">R$ {totalSales.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">Valor Contado na Gaveta (R$)</Label>
              <Input type="number" className="text-xl h-12 font-bold" placeholder="0.00"
                value={closingActual} onChange={e => setClosingActual(e.target.value)} autoFocus />
              {closingActual && !isNaN(parseFloat(closingActual)) && (
                <p className={cn("text-sm font-medium", parseFloat(closingActual) >= totalSales ? "text-emerald-600" : "text-rose-600")}>
                  {parseFloat(closingActual) >= totalSales
                    ? `✅ Confere (+R$ ${(parseFloat(closingActual) - totalSales).toFixed(2)})`
                    : `⚠️ Diferença: -R$ ${(totalSales - parseFloat(closingActual)).toFixed(2)}`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Input value={closingNote} onChange={e => setClosingNote(e.target.value)} placeholder="Ex: Conferido sem divergências..." />
            </div>
            {!currentCashSession && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Nenhuma sessão de caixa aberta no momento.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="font-bold px-6" onClick={handleCloseCashier}
              disabled={isSavingClose || !currentCashSession}>
              {isSavingClose ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Encerrar Sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════ ADMIN BANNER ══════════ */}
      {adminData && (
        <Card className="bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldCheck /> Acesso de Administrador
            </CardTitle>
            <CardDescription className="text-destructive/80">
              Você tem acesso ao painel de administração da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Use o painel do administrador para gerenciar todas as empresas, visualizar relatórios globais e supervisionar a plataforma.</p>
            <p className="text-sm text-destructive/90 mt-2">Logado como: <strong>{user?.email}</strong></p>
          </CardContent>
          <CardFooter>
            <Link href="/admin"><Button variant="destructive">Ir para o Painel do Admin</Button></Link>
          </CardFooter>
        </Card>
      )}

      {/* ══════════ PAINEL DE AÇÕES DO CAIXA ══════════ */}
      <Card className={cn(
        "border-2 shadow-sm transition-all",
        currentCashSession
          ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-background to-background"
          : "border-amber-200 bg-gradient-to-r from-amber-50 via-background to-background"
      )}>
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-sm shrink-0",
                currentCashSession ? "bg-emerald-500 text-white" : "bg-amber-400 text-white"
              )}>
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {currentCashSession ? (
                    <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" /> Caixa Aberto</>
                  ) : (
                    <><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Caixa Fechado</>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {currentCashSession
                    ? `Sessão ativa — Troco Inicial: R$ ${currentCashSession.openingBalance?.toFixed(2) ?? '0.00'}`
                    : 'Vá em Controle de Caixa para abrir uma sessão'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-semibold"
              onClick={() => setIsSangriaOpen(true)}
              disabled={!currentCashSession}
            >
              <ArrowDownCircle className="h-4 w-4" /> Sangria
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 font-semibold"
              onClick={() => setIsSuprimentoOpen(true)}
              disabled={!currentCashSession}
            >
              <ArrowUpCircle className="h-4 w-4" /> Suprimento
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400 font-semibold sm:ml-auto"
              onClick={() => setIsCloseOpen(true)}
              disabled={!currentCashSession}
            >
              <XCircle className="h-4 w-4" /> Fechar Caixa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ══════════ HEADER + FILTROS ══════════ */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Painel</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline"
                  className={cn("w-[240px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "LLL dd, y", { locale: ptBR })} — {format(dateRange.to, "LLL dd, y", { locale: ptBR })}</>
                    ) : format(dateRange.from, "LLL dd, y", { locale: ptBR })
                  ) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from}
                  selected={dateRange} onSelect={handleDateRangeChange} numberOfMonths={2} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Button onClick={() => handlePresetChange('today')} variant={activePreset === 'today' ? 'default' : 'outline'}>Hoje</Button>
            <Button onClick={() => handlePresetChange('week')} variant={activePreset === 'week' ? 'default' : 'outline'}>Semana</Button>
            <Button onClick={() => handlePresetChange('month')} variant={activePreset === 'month' ? 'default' : 'outline'}>Mês</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas {dateRangeLabel}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos {dateRangeLabel}</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">+{totalOrders}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio {dateRangeLabel}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{pendingOrders}</div></CardContent>
          </Card>
        </div>
      </div>

      {/* ══════════ CHART + FECHAMENTO ══════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Visão Geral de Vendas (Últimos 7 dias)</CardTitle></CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <BarChart data={salesChartData}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="col-span-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-muted-foreground" />
                Fechamento de Caixa {dateRangeLabel}
              </CardTitle>
              <CardDescription>Total de vendas do período detalhado por forma de pagamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Dinheiro', value: salesByPaymentMethod.cash, Icon: Banknote },
                  { label: 'PIX', value: salesByPaymentMethod.pix, Icon: Landmark },
                  { label: 'Cartão de Crédito', value: salesByPaymentMethod.credit, Icon: CreditCard },
                  { label: 'Cartão de Débito', value: salesByPaymentMethod.debit, Icon: CreditCard },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="flex items-center">
                    <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    <span className="font-medium">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex-col items-stretch space-y-2">
              <Separator />
              <div className="flex items-center font-bold text-lg pt-2">
                <DollarSign className="h-5 w-5 mr-3" />
                <span className="flex-1">Total</span>
                <span>R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <Button variant="outline" className="w-full" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ══════════ PEDIDOS RECENTES ══════════ */}
      <Card className="col-span-4 lg:col-span-7">
        <CardHeader><CardTitle>Pedidos Recentes</CardTitle></CardHeader>
        <CardContent>
          <RecentOrdersTable orders={recentOrdersWithDetails} />
        </CardContent>
      </Card>
    </div>
  );
}