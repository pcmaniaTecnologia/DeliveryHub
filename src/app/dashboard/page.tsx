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

const salesData = [
  { date: 'Jan', sales: Math.floor(Math.random() * 2000) + 1000 },
  { date: 'Fev', sales: Math.floor(Math.random() * 2000) + 1000 },
  { date: 'Mar', sales: Math.floor(Math.random() * 2000) + 1000 },
  { date: 'Abr', sales: Math.floor(Math.random() * 2000) + 1000 },
  { date: 'Mai', sales: Math.floor(Math.random() * 2000) + 1000 },
  { date: 'Jun', sales: Math.floor(Math.random() * 2000) + 1000 },
];

const recentOrders = [
    { name: 'Olivia Martin', email: 'olivia.martin@email.com', amount: 'R$42,25', status: 'Entregue' },
    { name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: 'R$99,00', status: 'Entregue' },
    { name: 'Isabella Nguyen', email: 'isabella.nguyen@email.com', amount: 'R$65,75', status: 'Em preparo' },
    { name: 'William Kim', email: 'will@email.com', amount: 'R$150,50', status: 'Saiu para entrega' },
    { name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: 'R$33,90', status: 'Cancelado' },
];

const chartConfig = {
  sales: {
    label: 'Vendas',
    color: 'hsl(var(--primary))',
  },
};

export default function DashboardPage() {
  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Painel</h2>
        <div className="flex items-center space-x-2">
            <Button>Hoje</Button>
            <Button variant="outline">Semana</Button>
            <Button variant="outline">Mês</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas (dia)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$4,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% do mês passado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos (dia)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+450</div>
            <p className="text-xs text-muted-foreground">+180.1% do mês passado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$23.50</div>
            <p className="text-xs text-muted-foreground">+19% do mês passado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">+2 desde a última hora</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <BarChart data={salesData}>
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} />
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
             <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {recentOrders.map(order => (
                        <TableRow key={order.email}>
                            <TableCell>
                                <div className="font-medium">{order.name}</div>
                                <div className="hidden text-sm text-muted-foreground md:inline">{order.email}</div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={order.status === 'Cancelado' ? 'destructive' : 'default'} className={
                                    order.status === 'Entregue' ? 'bg-green-500/20 text-green-700' :
                                    order.status === 'Em preparo' ? 'bg-yellow-500/20 text-yellow-700' :
                                    order.status === 'Saiu para entrega' ? 'bg-blue-500/20 text-blue-700' : ''
                                }>{order.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{order.amount}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
