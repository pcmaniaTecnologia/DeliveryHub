
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, type Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { DollarSign, Truck, Store, ClipboardList, Wallet, TrendingUp, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Order = {
    id: string;
    totalAmount: number;
    paymentMethod: string;
    payments?: { method: string, amount: number }[];
    deliveryType: string;
    status: string;
    orderDate: Timestamp;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PAYMENT_COLORS: { [key: string]: string } = {
    'Dinheiro': '#10b981',
    'PIX': '#06b6d4',
    'Cartão de Crédito': '#f59e0b',
    'Cartão de Débito': '#f43f5e',
    'Outros': '#64748b'
};

export default function ReportsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return collection(firestore, `companies/${user.uid}/orders`);
    }, [firestore, user?.uid]);

    const { data: orders, isLoading } = useCollection<Order>(ordersRef);

    const mapMethodName = (name: string) => {
        const n = (name || '').toLowerCase();
        if (n.includes('dinheiro')) return 'Dinheiro';
        if (n.includes('pix')) return 'PIX';
        if (n.includes('crédito') || n.includes('credito')) return 'Cartão de Crédito';
        if (n.includes('débito') || n.includes('debito')) return 'Cartão de Débito';
        return 'Outros';
    };

    const reportData = useMemo(() => {
        if (!orders) return null;

        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));

        const filtered = orders.filter(order => {
            const date = order.orderDate.toDate();
            const isInRange = isWithinInterval(date, { start, end });
            const isFinished = ['Entregue', 'Finalizado', 'Entregue à mesa'].includes(order.status);
            return isInRange && isFinished;
        });

        // Totals
        const totalFaturamento = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const byType = {
            delivery: filtered.filter(o => o.deliveryType === 'Delivery' || o.deliveryType === 'Retirada').reduce((sum, o) => sum + o.totalAmount, 0),
            balcao: filtered.filter(o => o.deliveryType === 'Balcão').reduce((sum, o) => sum + o.totalAmount, 0),
            comanda: filtered.filter(o => o.deliveryType === 'Mesa').reduce((sum, o) => sum + o.totalAmount, 0),
        };

        // Payment Distribution - Normalization
        const paymentsMap: { [key: string]: number } = {
            'Dinheiro': 0,
            'PIX': 0,
            'Cartão de Crédito': 0,
            'Cartão de Débito': 0,
            'Outros': 0
        };

        filtered.forEach(o => {
            if (o.payments && o.payments.length > 0) {
                o.payments.forEach(p => {
                    const method = mapMethodName(p.method);
                    paymentsMap[method] += (p.amount || 0);
                });
            } else {
                const str = o.paymentMethod || '';
                if (str.includes('|')) {
                    const parts = str.split('|');
                    parts.forEach(part => {
                        const match = part.match(/(.*?):\s*R\$\s*([\d,.]+)/);
                        if (match) {
                            const method = mapMethodName(match[1]);
                            const amount = parseFloat(match[2].replace(',', '.'));
                            paymentsMap[method] += isNaN(amount) ? 0 : amount;
                        } else {
                            const method = mapMethodName(part);
                            paymentsMap[method] += (o.totalAmount / parts.length);
                        }
                    });
                } else {
                    const method = mapMethodName(str);
                    paymentsMap[method] += o.totalAmount;
                }
            }
        });

        const paymentsData = Object.entries(paymentsMap)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));

        // Daily Faturamento Chart
        const dailyMap: { [key: string]: number } = {};
        filtered.forEach(o => {
            const day = format(o.orderDate.toDate(), 'dd/MM');
            dailyMap[day] = (dailyMap[day] || 0) + o.totalAmount;
        });
        const dailyData = Object.entries(dailyMap).map(([date, total]) => ({ date, total }))
            .sort((a, b) => {
                const [da, ma] = a.date.split('/').map(Number);
                const [db, mb] = b.date.split('/').map(Number);
                return (ma * 100 + da) - (mb * 100 + db);
            });

        // Type Distribution for Bar Chart
        const typeData = [
            { name: 'Delivery', value: byType.delivery },
            { name: 'Balcão', value: byType.balcao },
            { name: 'Comandas', value: byType.comanda },
        ];

        return {
            totalFaturamento,
            byType,
            paymentsData,
            dailyData,
            typeData,
            orderCount: filtered.length,
            recentOrders: filtered.sort((a,b) => b.orderDate.toMillis() - a.orderDate.toMillis()).slice(0, 10)
        };
    }, [orders, startDate, endDate]);

    if (isUserLoading || isLoading) return <div className="p-8 text-center text-muted-foreground font-medium">Gerando relatórios...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Relatórios de Vendas</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Analise o desempenho do seu negócio no período.
                    </p>
                </div>
                
                <Card className="p-2 border-primary/20 bg-primary/5 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="start" className="text-[10px] uppercase font-bold text-muted-foreground px-1">Início</Label>
                            <Input 
                                id="start" 
                                type="date" 
                                className="h-9 w-40" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                            />
                        </div>
                        <Calendar className="h-4 w-4 text-muted-foreground mt-4" />
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="end" className="text-[10px] uppercase font-bold text-muted-foreground px-1">Fim</Label>
                            <Input 
                                id="end" 
                                type="date" 
                                className="h-9 w-40" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-primary shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-muted-foreground font-medium">
                        <CardTitle className="text-sm">Faturamento Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {reportData?.totalFaturamento.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{reportData?.orderCount} pedidos concluídos</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-muted-foreground font-medium">
                        <CardTitle className="text-sm">Delivery / Retirada</CardTitle>
                        <Truck className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {reportData?.byType.delivery.toFixed(2)}</div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-muted-foreground font-medium">
                        <CardTitle className="text-sm">Balcão (PDV)</CardTitle>
                        <Store className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {reportData?.byType.balcao.toFixed(2)}</div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 text-muted-foreground font-medium">
                        <CardTitle className="text-sm">Comandas (Mesa)</CardTitle>
                        <ClipboardList className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">R$ {reportData?.byType.comanda.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Faturamento Diário</CardTitle>
                        <CardDescription>Evolução financeira no período selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={reportData?.dailyData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(value) => `R$${value}`} />
                                <Tooltip formatter={(value) => typeof value === 'number' ? `R$ ${value.toFixed(2)}` : value} labelStyle={{ fontWeight: 'bold' }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="total" 
                                    stroke="hsl(var(--primary))" 
                                    fillOpacity={1} 
                                    fill="url(#colorTotal)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
                        <CardDescription>Distribuição do faturamento por tipo de recebimento.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData?.paymentsData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {reportData?.paymentsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => typeof value === 'number' ? `R$ ${value.toFixed(2)}` : value} />
                                <Legend verticalAlign="bottom" height={36}/>
                                <text 
                                    x="50%" 
                                    y="48%" 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    className="fill-muted-foreground text-[10px] uppercase font-bold tracking-wider"
                                >
                                    Faturamento
                                </text>
                                <text 
                                    x="50%" 
                                    y="55%" 
                                    textAnchor="middle" 
                                    dominantBaseline="middle" 
                                    className="fill-foreground font-bold text-base"
                                >
                                    R$ {reportData?.totalFaturamento.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Vendas por Tipo</CardTitle>
                        <CardDescription>Volume financeiro por categoria de atendimento.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData?.typeData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => `R$${value}`} />
                                <Tooltip formatter={(value) => typeof value === 'number' ? `R$ ${value.toFixed(2)}` : value} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {reportData?.typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Table Section: Recent Orders */}
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Últimos Pedidos</CardTitle>
                            <CardDescription>Últimas 10 vendas do período.</CardDescription>
                        </div>
                        <Wallet className="h-5 w-5 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs uppercase">Data</TableHead>
                                    <TableHead className="text-xs uppercase">Tipo</TableHead>
                                    <TableHead className="text-xs uppercase">Pagamento</TableHead>
                                    <TableHead className="text-xs uppercase text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData?.recentOrders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="text-xs">{format(order.orderDate.toDate(), 'dd/MM HH:mm')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] font-bold">
                                                {order.deliveryType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">{order.paymentMethod}</TableCell>
                                        <TableCell className="text-right font-bold text-xs">R$ {order.totalAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {reportData?.recentOrders.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                                            Nenhuma venda encontrada neste período.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper Badge component to avoid extra imports if not needed, but we'll use a local styled div
function Badge({ children, variant, className }: any) {
    const variants: any = {
        outline: "border-primary/20 text-primary bg-primary/5",
        default: "bg-primary text-primary-foreground",
    };
    return (
        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant || 'default']} ${className}`}>
            {children}
        </div>
    );
}

