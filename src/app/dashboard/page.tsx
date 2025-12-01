'use client';
import { DollarSign, Package, ShoppingCart, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, type Timestamp } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Order = {
  id: string;
  customerId: string;
  orderDate: Timestamp;
  status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
  totalAmount: number;
  customerName?: string; // Will be added dynamically
};

type Customer = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

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
                        <TableCell className="text-right">R${order.totalAmount.toFixed(2)}</TableCell>
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
        recentOrdersWithDetails
    } = useMemo(() => {
        if (!orders) {
            return { 
                totalSales: 0, 
                totalOrders: 0, 
                avgTicket: 0, 
                pendingOrders: 0,
                salesChartData: [],
                recentOrders: [],
                recentOrdersWithDetails: []
            };
        }

        const now = new Date();
        const startOfToday = startOfDay(now);
        const endOfToday = endOfDay(now);

        const ordersToday = orders.filter(order => {
            const orderDate = order.orderDate.toDate();
            return isWithinInterval(orderDate, { start: startOfToday, end: endOfToday });
        });

        const totalSales = ordersToday.reduce((sum, order) => order.status !== 'Cancelado' ? sum + order.totalAmount : sum, 0);
        const successfulOrdersToday = ordersToday.filter(order => order.status !== 'Cancelado');
        const totalOrders = successfulOrdersToday.length;
        const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
        
        const pendingOrders = orders.filter(order => ['Novo', 'Aguardando pagamento', 'Em preparo'].includes(order.status)).length;
        
        // Sales chart data for the last 7 days
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

        return { totalSales, totalOrders, avgTicket, pendingOrders, salesChartData, recentOrdersWithDetails };

    }, [orders]);
    
    // This is a placeholder for fetching customer details.
    // In a real app, you might fetch customer names based on recentOrdersWithDetails customerIds.
    // For simplicity, we'll just display ID for now if name is not on order.
    
    const isLoading = isUserLoading || isLoadingOrders;

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
            <CardTitle className="text-sm font-medium">Total de Vendas (dia)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${totalSales.toFixed(2)}</div>
            {/* <p className="text-xs text-muted-foreground">+20.1% do mês passado</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos (dia)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalOrders}</div>
            {/* <p className="text-xs text-muted-foreground">+180.1% do mês passado</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${avgTicket.toFixed(2)}</div>
            {/* <p className="text-xs text-muted-foreground">+19% do mês passado</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            {/* <p className="text-xs text-muted-foreground">+2 desde a última hora</p> */}
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
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
             <RecentOrdersTable orders={recentOrdersWithDetails} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
