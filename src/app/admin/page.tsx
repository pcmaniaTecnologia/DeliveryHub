'use client';

import { Building, DollarSign, ShoppingCart, Calendar as CalendarIcon, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, collectionGroup, getDocs, query, Timestamp } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, endOfDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type Company = {
    id: string;
    name: string;
    isActive?: boolean;
    planId?: string;
};

type Order = {
    id: string;
    companyId: string;
    status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
    totalAmount: number;
    orderDate?: Timestamp | Date | any;
};

type Plan = {
    id: string;
    name: string;
    price: number;
    billingType: 'monthly' | 'per_order';
    pricePerOrder?: number;
};

type CompanyEarnings = {
    name: string;
    Ganho: number;
};

const chartConfig = {
  sales: {
    label: 'Ganhos',
    color: 'hsl(var(--primary))',
  },
};

export default function AdminDashboardPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [rawCompanies, setRawCompanies] = useState<Company[]>([]);
    const [rawOrders, setRawOrders] = useState<Order[]>([]);
    const [rawPlans, setRawPlans] = useState<Record<string, Plan>>({});
    
    const [isLoading, setIsLoading] = useState(true);
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    });
    const [shopSearch, setShopSearch] = useState('');

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 0. Fetch all plans
                const plansQuery = collection(firestore, 'plans');
                const plansSnapshot = await getDocs(plansQuery);
                const plansRecord = plansSnapshot.docs.reduce((acc, doc) => {
                    acc[doc.id] = { id: doc.id, ...doc.data() } as Plan;
                    return acc;
                }, {} as Record<string, Plan>);
                setRawPlans(plansRecord);

                // 1. Fetch all companies
                const companiesQuery = collection(firestore, 'companies');
                const companiesSnapshot = await getDocs(companiesQuery).catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: 'companies',
                        operation: 'list',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    throw permissionError;
                });
                
                const allCompanies = companiesSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        return { 
                            id: doc.id, 
                            name: data.name || "Sem nome",
                            isActive: data.isActive,
                            planId: data.planId
                        } as Company;
                    });
                setRawCompanies(allCompanies);

                // 2. Fetch all orders
                const ordersQuery = query(collectionGroup(firestore, 'orders'));
                const ordersSnapshot = await getDocs(ordersQuery).catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: 'orders',
                        operation: 'list',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    throw permissionError; 
                });
                
                const allOrders = ordersSnapshot.docs.map(doc => {
                    const data = doc.data();
                    let dateObj: Date | undefined;
                    if (data.orderDate?.toDate) {
                        dateObj = data.orderDate.toDate();
                    } else if (data.orderDate) {
                        dateObj = new Date(data.orderDate);
                    }
                    return { ...data, orderDate: dateObj } as Order;
                });
                
                // Filter successful orders only
                const successfulOrders = allOrders.filter(order => 
                    order && 
                    order.status !== 'Cancelado' &&
                    order.totalAmount !== undefined &&
                    !isNaN(Number(order.totalAmount))
                );
                setRawOrders(successfulOrders);
            } catch(e) {
                console.error("Dashboard fetch error", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [firestore, user]);

    const stats = useMemo(() => {
        // 1. First, filter orders by date range
        let filteredOrders = rawOrders;
        if (dateRange?.from) {
            const start = startOfDay(dateRange.from);
            const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            filteredOrders = rawOrders.filter(order => {
                if (!order.orderDate) return false;
                const d = order.orderDate;
                return d >= start && d <= end;
            });
        }

        const activeCompanies = rawCompanies.filter(c => !!c.isActive);
        const inactiveCount = rawCompanies.length - activeCompanies.length;

        // 2. Then calculate earnings (Fixed vs Variable)
        let fixedRevenue = 0;
        let variableRevenue = 0;

        const salesByCompany = activeCompanies.map(company => {
            const plan = rawPlans[company.planId!];
            let companyFixed = 0;
            let companyVariable = 0;

            if (plan) {
                if (plan.billingType === 'monthly') {
                    companyFixed = Number(plan.price) || 0;
                } else if (plan.billingType === 'per_order') {
                    const companyOrders = filteredOrders.filter(o => o.companyId === company.id);
                    companyVariable = companyOrders.length * (Number(plan.pricePerOrder) || 0);
                    companyFixed = Number(plan.price) || 0;
                }
            }

            fixedRevenue += companyFixed;
            variableRevenue += companyVariable;

            return {
                name: company.name,
                Ganho: companyFixed + companyVariable,
                Fixo: companyFixed,
                Variavel: companyVariable
            };
        }).filter(s => s.Ganho > 0);

        // 3. Orders by company for table
        const ordersByCompany = rawCompanies.map(company => {
             const companyOrders = filteredOrders.filter(o => o.companyId === company.id);
             return {
                 id: company.id,
                 name: company.name,
                 quantidadePedidos: companyOrders.length,
                 totalVendido: companyOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
                 isActive: company.isActive !== false
             };
        }).sort((a,b) => b.quantidadePedidos - a.quantidadePedidos);

        return {
            fixedRevenue,
            variableRevenue,
            totalCompanies: rawCompanies.length,
            activeCount: activeCompanies.length,
            inactiveCount,
            totalOrdersInPeriod: filteredOrders.length,
            salesByCompany,
            ordersByCompany
        };

    }, [rawCompanies, rawOrders, rawPlans, dateRange]);


    if (isLoading || isUserLoading) {
        return <p>Carregando dashboard do administrador...</p>;
    }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
           <h2 className="text-3xl font-bold tracking-tight">Dashboard do Administrador</h2>
           <div className="flex items-center gap-2">
               <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[260px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                                        {format(dateRange.to, "dd/MM/yyyy")}
                                    </>
                                ) : (
                                    format(dateRange.from, "dd/MM/yyyy")
                                )
                            ) : (
                                <span>Filtrar por data</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganhos em Assinatura (Fixo)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R${stats?.fixedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">receita mensal recorrente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganhos por Contrato (Variável)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">R${stats?.variableRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">comissão sobre pedidos (período)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Lojas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCompanies}</div>
            <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                     {stats?.activeCount} Ativas
                </Badge>
                <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                     {stats?.inactiveCount} Inativas
                </Badge>
            </div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos no Período</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrdersInPeriod}</div>
            <p className="text-xs text-muted-foreground">de todas as lojas (período selecionado)</p>
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Ganhos por Loja Assinante</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={stats?.salesByCompany} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/>
                  <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={120} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Ganho" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Ganho" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Quantidade de Pedidos por Loja Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
            <div>
              <CardTitle>Controle de Pedidos por Loja</CardTitle>
              <CardDescription>Acompanhe a quantidade e o volume de vendas das lojas no período filtrado.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72 mt-2 sm:mt-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar loja específica..."
                className="pl-8"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
               <TableHeader>
                   <TableRow>
                       <TableHead>Loja</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead className="text-right">Pedidos</TableHead>
                       <TableHead className="text-right">Volume Vendido</TableHead>
                   </TableRow>
               </TableHeader>
               <TableBody>
                   {stats?.ordersByCompany
                       .filter(store => store.name.toLowerCase().includes(shopSearch.toLowerCase()))
                       .map(store => (
                       <TableRow key={store.id}>
                           <TableCell className="font-medium">{store.name}</TableCell>
                           <TableCell>
                               {store.isActive ? (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Ativa</Badge>
                               ) : (
                                    <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">Desativada</Badge>
                               )}
                           </TableCell>
                           <TableCell className="text-right font-bold">{store.quantidadePedidos}</TableCell>
                           <TableCell className="text-right text-muted-foreground">R$ {store.totalVendido.toFixed(2)}</TableCell>
                       </TableRow>
                   ))}
               </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}
