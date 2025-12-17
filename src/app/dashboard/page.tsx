
'use client';
import { Banknote, CreditCard, DollarSign, Package, PieChart, Landmark, ShoppingCart, Users } from 'lucide-react';
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
import { useState, useMemo } from 'react';
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

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

        const now = new Date();
        let startDate: Date;

        switch(dateRange) {
            case 'week':
                startDate = startOfDay(subDays(now, 6));
                break;
            case 'month':
                startDate = startOfDay(subDays(now, 29));
                break;
            case 'today':
            default:
                startDate = startOfDay(now);
                break;
        }

        const endDate = endOfDay(now);

        const filteredOrders = orders.filter(order => {
            const orderDate = order.orderDate.toDate();
            return isWithinInterval(orderDate, { start: startDate, end: endDate });
        });

        const successfulOrders = filteredOrders.filter(order => order.status !== 'Cancelado');

        const totalSales = successfulOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = successfulOrders.length;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        
        const pendingOrders = orders.filter(order => ['Novo', 'Aguardando pagamento', 'Em preparo'].includes(order.status)).length;
        
        const salesByPaymentMethod = successfulOrders.reduce<SalesByPaymentMethod>((acc, order) => {
            const methods = order.paymentMethod.split(', ');
            const orderTotal = order.totalAmount;
            const methodsWithValues = methods.map(m => {
                const match = m.match(/(.+) \(R\$\s*([\d,.]+)\)/);
                if (match) {
                    const amount = parseFloat(match[2].replace('.', '').replace(',', '.'));
                    return { method: match[1].trim(), amount };
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

        const salesChartData = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(now, i);
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
    
    const dateRangeLabel = {
        today: '(dia)',
        week: '(semana)',
        month: '(mês)',
    }[dateRange];

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
            <Button onClick={() => setDateRange('today')} variant={dateRange === 'today' ? 'default' : 'outline'}>Hoje</Button>
            <Button onClick={() => setDateRange('week')} variant={dateRange === 'week' ? 'default' : 'outline'}>Semana</Button>
            <Button onClick={() => setDateRange('month')} variant={dateRange === 'month' ? 'default' : 'outline'}>Mês</Button>
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
                <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-muted-foreground" />
                    Fechamento de Caixa {dateRangeLabel}
                </CardTitle>
                <CardDescription>
                    Total de vendas do período detalhado por forma de pagamento.
                </CardDescription>
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
    </>
  );
}
