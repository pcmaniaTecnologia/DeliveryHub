
'use client';
import { Banknote, CreditCard, DollarSign, Package, PieChart, Landmark, ShoppingCart, Users, Calendar as CalendarIcon, Printer } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, type Timestamp } from 'firebase/firestore';
import { useState, useMemo, useRef, forwardRef, type Ref } from 'react';
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import ReactToPrint, { useReactToPrint } from 'react-to-print';
import { Separator } from '@/components/ui/separator';


type Order = {
  id: string;
  customerId: string;
  orderDate: Timestamp;
  status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
  totalAmount: number;
  paymentMethod: string;
  customerName?: string; // Will be added dynamically
};

type Customer = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

type SalesByPaymentMethod = {
    cash: number;
    pix: number;
    credit: number;
    debit: number;
};

const chartConfig = {
  sales: {
    label: 'Vendas',
    color: 'hsl(var(--primary))',
  },
};

const CashierClosingPrintable = forwardRef<HTMLDivElement, { 
    salesByPaymentMethod: SalesByPaymentMethod, 
    totalSales: number,
    dateRangeLabel: string,
}>(({ salesByPaymentMethod, totalSales, dateRangeLabel }, ref) => {
    return (
        <div ref={ref} className="p-6 font-sans">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Fechamento de Caixa</h2>
                <p className="text-sm text-gray-500">Período: {dateRangeLabel}</p>
                 <p className="text-sm text-gray-500">Gerado em: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            </div>
             <div className="space-y-4 text-base">
                    <div className="flex items-center">
                        <Banknote className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Dinheiro</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.cash.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center">
                        <Landmark className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">PIX</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <Separator />
                    <div className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Cartão de Crédito</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <Separator />
                    <div className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Cartão de Débito</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.debit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <Separator className="my-6" />
                     <div className="flex items-center text-xl">
                        <DollarSign className="h-6 w-6 mr-3" />
                        <span className="flex-1 font-bold">Total</span>
                        <span className="font-bold">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
        </div>
    );
});
CashierClosingPrintable.displayName = 'CashierClosingPrintable';


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
                             <Badge variant={order.status === 'Cancelado' ? 'destructive' : 'default'} className="whitespace-nowrap">{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">R${order.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export default function DashboardPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return collection(firestore, `companies/${user.uid}/orders`);
    }, [firestore, user?.uid]);
    
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);

    const [activePreset, setActivePreset] = useState<'today' | 'week' | 'month' | null>('today');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      });
      
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    });

    const handlePresetChange = (preset: 'today' | 'week' | 'month') => {
        setActivePreset(preset);
        const now = new Date();
        let fromDate: Date;
        switch(preset) {
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
        setDateRange({ from: fromDate, to: endOfDay(now) });
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        if (range) {
            setDateRange({
                from: range.from ? startOfDay(range.from) : undefined,
                to: range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined,
              });
            setActivePreset(null); // Deselect preset when custom range is chosen
        }
    }


    const { 
        totalSales, 
        totalOrders, 
        avgTicket, 
        pendingOrders,
        salesChartData,
        recentOrdersWithDetails,
        salesByPaymentMethod
    } = useMemo(() => {
        if (!orders) {
            return { 
                totalSales: 0, 
                totalOrders: 0, 
                avgTicket: 0, 
                pendingOrders: 0,
                salesChartData: [],
                recentOrders: [],
                recentOrdersWithDetails: [],
                salesByPaymentMethod: { cash: 0, pix: 0, credit: 0, debit: 0 }
            };
        }

        const filteredOrders = orders.filter(order => {
            if (!dateRange?.from) return false;
            const orderDate = order.orderDate.toDate();
            const toDate = dateRange.to || dateRange.from;
            return isWithinInterval(orderDate, { start: dateRange.from, end: toDate });
        });

        const successfulOrders = filteredOrders.filter(order => order.status !== 'Cancelado');

        const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = successfulOrders.length;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        
        // Pending orders should probably not be filtered by date range, but all pending orders ever
        const pendingOrders = orders.filter(order => ['Novo', 'Aguardando pagamento', 'Em preparo'].includes(order.status)).length;
        
        const salesByPaymentMethod = successfulOrders.reduce<SalesByPaymentMethod>((acc, order) => {
            const methods = order.paymentMethod.split(', ');
            const orderTotal = order.totalAmount;
            const methodsWithValues = methods.map(m => {
                const match = m.match(/(.+) \(troco para R\$\s*([\d,.]+)\)/);
                if (match) {
                    return { method: match[1].trim(), amount: orderTotal }; // The whole order was paid this way
                }
                const matchWithValue = m.match(/(.+) \(R\$\s*([\d,.]+)\)/);
                 if (matchWithValue) {
                    const amount = parseFloat(matchWithValue[2].replace(',', '.'));
                    return { method: matchWithValue[1].trim(), amount };
                }
                return { method: m.trim(), amount: null };
            });

            if (methodsWithValues.length === 1 && methodsWithValues[0].amount === null) {
                 const singleMethod = methodsWithValues[0].method.toLowerCase();
                 if (singleMethod.includes('dinheiro')) acc.cash += orderTotal;
                 else if (singleMethod.includes('pix')) acc.pix += orderTotal;
                 else if (singleMethod.includes('crédito')) acc.credit += orderTotal;
                 else if (singleMethod.includes('débito')) acc.debit += orderTotal;
            } else { 
                 methodsWithValues.forEach(({ method, amount }) => {
                    const methodLc = method.toLowerCase();
                    const value = amount || 0;
                    if (methodLc.includes('dinheiro')) acc.cash += value;
                    else if (methodLc.includes('pix')) acc.pix += value;
                    else if (methodLc.includes('crédito')) acc.credit += value;
                    else if (methodLc.includes('débito')) acc.debit += value;
                });
            }

            return acc;
        }, { cash: 0, pix: 0, credit: 0, debit: 0 });

        // Sales chart always shows last 7 days regardless of filter
        const salesChartData = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), i);
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);
            
            const daySales = orders
                .filter(order => {
                    const orderDate = order.orderDate.toDate();
                    return isWithinInterval(orderDate, { start: dayStart, end: dayEnd }) && order.status !== 'Cancelado';
                })
                .reduce((sum, order) => sum + order.totalAmount, 0);

            return {
                date: format(date, 'dd/MM', { locale: ptBR }),
                Vendas: daySales
            };
        }).reverse();
        
        const recentOrders = [...orders]
            .sort((a, b) => b.orderDate.toDate().getTime() - a.orderDate.toDate().getTime())
            .slice(0, 5);
        
        const recentOrdersWithDetails = recentOrders;

        return { totalSales, totalOrders, avgTicket, pendingOrders, salesChartData, recentOrdersWithDetails, salesByPaymentMethod };

    }, [orders, dateRange]);
    
    const isLoading = isUserLoading || isLoadingOrders;
    
    const dateRangeLabel = useMemo(() => {
        if (!dateRange?.from) return '';

        const from = format(dateRange.from, 'P', { locale: ptBR });
        const to = dateRange.to ? format(dateRange.to, 'P', { locale: ptBR }) : from;

        if (from === to) {
            return `(${from})`;
        }
        return `(${from} - ${to})`;
    }, [dateRange]);


    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Carregando painel...</p>
            </div>
        );
    }
  
  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Painel</h2>
        <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y", { locale: ptBR })
                    )
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleDateRangeChange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => handlePresetChange('today')} variant={activePreset === 'today' ? 'default' : 'outline'}>Hoje</Button>
            <Button onClick={() => handlePresetChange('week')} variant={activePreset === 'week' ? 'default' : 'outline'}>Semana</Button>
            <Button onClick={() => handlePresetChange('month')} variant={activePreset === 'month' ? 'default' : 'outline'}>Mês</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <CardContent>
            <div className="text-2xl font-bold">+{totalOrders}</div>
          </CardContent>
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
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral de Vendas (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <BarChart data={salesChartData}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-4 lg:col-span-3">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-muted-foreground" />
                            Fechamento de Caixa {dateRangeLabel}
                        </CardTitle>
                        <CardDescription>
                            Total de vendas do período detalhado por forma de pagamento.
                        </CardDescription>
                    </div>
                     <Button onClick={handlePrint} variant="outline" size="icon">
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">Imprimir</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex items-center">
                        <Banknote className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Dinheiro</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.cash.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center">
                        <Landmark className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">PIX</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Cartão de Crédito</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1">Cartão de Débito</span>
                        <span className="font-medium">R$ {salesByPaymentMethod.debit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <div className="flex items-center border-t pt-4 mt-4">
                        <DollarSign className="h-5 w-5 mr-3 text-muted-foreground" />
                        <span className="flex-1 font-bold">Total</span>
                        <span className="font-bold text-lg">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

       <Card className="col-span-4 lg:col-span-7">
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
             <RecentOrdersTable orders={recentOrdersWithDetails} />
          </CardContent>
        </Card>
        
        <div className="hidden">
            <CashierClosingPrintable 
                ref={printRef} 
                salesByPaymentMethod={salesByPaymentMethod} 
                totalSales={totalSales} 
                dateRangeLabel={dateRangeLabel.replace(/[()]/g, '')} // remove parentheses
            />
        </div>
    </>
  );
}
