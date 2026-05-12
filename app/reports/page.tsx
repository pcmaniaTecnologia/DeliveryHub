
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
import { DollarSign, Truck, Store, ClipboardList, Wallet, TrendingUp, Calendar, AlertCircle, Package, BarChart3, Activity } from 'lucide-react';
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
    orderItems?: {
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
    }[];
}

type Product = {
    id: string;
    name: string;
    stock: number;
    stockControlEnabled?: boolean;
    categoryId: string;
}

type Category = {
    id: string;
    name: string;
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

    const productsRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return collection(firestore, `companies/${user.uid}/products`);
    }, [firestore, user?.uid]);

    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

    const categoriesRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return collection(firestore, `companies/${user.uid}/categories`);
    }, [firestore, user?.uid]);

    const { data: categories } = useCollection<Category>(categoriesRef);

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

        // Payment Distribution
        const paymentsMap: { [key: string]: number } = {
            'Dinheiro': 0, 'PIX': 0, 'Cartão de Crédito': 0, 'Cartão de Débito': 0, 'Outros': 0
        };

        filtered.forEach(o => {
            if (o.payments && o.payments.length > 0) {
                o.payments.forEach(p => {
                    const method = mapMethodName(p.method);
                    paymentsMap[method] += (p.amount || 0);
                });
            } else {
                const method = mapMethodName(o.paymentMethod || '');
                paymentsMap[method] += o.totalAmount;
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

        // Type Distribution
        const typeData = [
            { name: 'Delivery', value: byType.delivery },
            { name: 'Balcão', value: byType.balcao },
            { name: 'Comandas', value: byType.comanda },
        ];

        // Top Products Logic
        const productStats: { [key: string]: { name: string, quantity: number, total: number } } = {};
        filtered.forEach(order => {
            (order.orderItems || []).forEach(item => {
                if (!productStats[item.productId]) {
                    productStats[item.productId] = { name: item.productName || 'Produto s/ Nome', quantity: 0, total: 0 };
                }
                productStats[item.productId].quantity += (item.quantity || 0);
                productStats[item.productId].total += (item.quantity * item.unitPrice) || 0;
            });
        });

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        // Low Stock Logic
        const lowStockProducts = (products || [])
            .filter(p => p.stockControlEnabled && (Number(p.stock) || 0) <= 0)
            .map(p => ({
                ...p,
                categoryName: categories?.find(c => c.id === p.categoryId)?.name || 'Sem Categoria'
            }));

        return {
            totalFaturamento, byType, paymentsData, dailyData, typeData,
            orderCount: filtered.length,
            topProducts, lowStockProducts
        };
    }, [orders, products, categories, startDate, endDate]);

    if (isUserLoading || isLoading || isLoadingProducts) return <div className="p-8 text-center text-muted-foreground font-medium flex flex-col items-center gap-4">
        <Activity className="h-8 w-8 animate-spin text-primary" />
        Gerando relatórios...
    </div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-blue-600">Relatórios de Vendas (ATUALIZADO)</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Analise o desempenho do seu negócio no período.
                    </p>
                </div>
                
                <Card className="p-2 border-primary/20 bg-primary/5 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="start" className="text-[10px] uppercase font-bold text-muted-foreground px-1">Início</Label>
                            <Input id="start" type="date" className="h-9 w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <Calendar className="h-4 w-4 text-muted-foreground mt-4" />
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="end" className="text-[10px] uppercase font-bold text-muted-foreground px-1">Fim</Label>
                            <Input id="end" type="date" className="h-9 w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-primary shadow-sm"><CardHeader className="pb-2 text-sm">Faturamento Total</CardHeader><CardContent><div className="text-2xl font-bold">R$ {reportData?.totalFaturamento.toFixed(2)}</div></CardContent></Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm"><CardHeader className="pb-2 text-sm">Delivery / Retirada</CardHeader><CardContent><div className="text-2xl font-bold">R$ {reportData?.byType.delivery.toFixed(2)}</div></CardContent></Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm"><CardHeader className="pb-2 text-sm">Balcão (PDV)</CardHeader><CardContent><div className="text-2xl font-bold">R$ {reportData?.byType.balcao.toFixed(2)}</div></CardContent></Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm"><CardHeader className="pb-2 text-sm">Comandas (Mesa)</CardHeader><CardContent><div className="text-2xl font-bold">R$ {reportData?.byType.comanda.toFixed(2)}</div></CardContent></Card>
            </div>

            {/* Inventory and Performance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm border-t-4 border-t-primary">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Produtos Mais Vendidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Faturamento</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {reportData?.topProducts?.map((p, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-xs font-medium">{p.name}</TableCell>
                                        <TableCell className="text-center font-bold text-xs">{p.quantity}</TableCell>
                                        <TableCell className="text-right text-xs">R$ {p.total.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-t-4 border-t-destructive">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Estoque Crítico</CardTitle>
                        <Badge className="bg-destructive text-white">{reportData?.lowStockProducts?.length || 0} itens</Badge>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Estoque</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {reportData?.lowStockProducts?.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="text-xs font-bold">{p.name}</TableCell>
                                        <TableCell className="text-right font-black text-xs text-destructive">{p.stock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle>Faturamento Diário</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer><AreaChart data={reportData?.dailyData}><XAxis dataKey="date" /><YAxis /><Tooltip /><Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></CardContent></Card>
                <Card><CardHeader><CardTitle>Formas de Pagamento</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer><PieChart><Pie data={reportData?.paymentsData} cx="50%" cy="50%" outerRadius={80} dataKey="value"><Cell fill="#10b981" /><Cell fill="#06b6d4" /><Cell fill="#f59e0b" /><Cell fill="#f43f5e" /></Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
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

