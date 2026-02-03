'use client';

import { Building, DollarSign, ShoppingCart } from 'lucide-react';
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
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, collectionGroup, getDocs, query } from 'firebase/firestore';
import { useState, useEffect } from 'react';


type Company = {
    id: string;
    name: string;
    isActive?: boolean;
};

type Order = {
    id: string;
    companyId: string;
    status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
    totalAmount: number;
};

type CompanySales = {
    name: string;
    Vendas: number;
};

const chartConfig = {
  sales: {
    label: 'Vendas',
    color: 'hsl(var(--primary))',
  },
};


export default function AdminDashboardPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalCompanies: 0,
        totalOrders: 0,
        salesByCompany: [] as CompanySales[],
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) return;

        const fetchData = async () => {
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
                .map(doc => ({ id: doc.id, ...doc.data() } as Company))
                .filter(company => company && company.name);
                
            const activeCompanies = allCompanies.filter(c => c.isActive);

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
            
            const allOrders = ordersSnapshot.docs.map(doc => doc.data() as Order);

            // Filter for successful orders and ensure totalAmount is a valid number
            const successfulOrders = allOrders.filter(order => 
                order && 
                order.status !== 'Cancelado' &&
                order.totalAmount !== undefined &&
                !isNaN(Number(order.totalAmount))
            );

            // 3. Process data for active companies
            const salesByCompany = activeCompanies.map(company => {
                const companyOrders = successfulOrders.filter(order => order.companyId === company.id);
                const totalSales = companyOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
                return {
                    name: company.name,
                    Vendas: totalSales,
                };
            }).filter(sale => sale.name && !isNaN(sale.Vendas)); // Final safety filter
            
            const totalRevenue = salesByCompany.reduce((sum, company) => sum + company.Vendas, 0);

            // 4. Set state
            setStats({
                totalRevenue: totalRevenue,
                totalCompanies: allCompanies.length,
                totalOrders: successfulOrders.length,
                salesByCompany: salesByCompany,
            });
        };

        setIsLoading(true);
        fetchData()
            .catch(error => {
                // Errors are thrown by FirebaseErrorListener, so we don't need to log here.
                // We just need to ensure the loading state is correct.
            })
            .finally(() => {
                setIsLoading(false);
            });
            
    }, [firestore, user]);


    if (isLoading || isUserLoading) {
        return <p>Carregando dashboard do administrador...</p>;
    }

  return (
    <div className="space-y-6">
       <h2 className="text-3xl font-bold tracking-tight">Dashboard do Administrador</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total (Lojas Ativas)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">de todas as lojas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Lojas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.totalCompanies}</div>
             <p className="text-xs text-muted-foreground">lojas ativas e inativas</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">contagem de todos os pedidos</p>
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Faturamento por Loja (Ativas)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer>
                <BarChart data={stats.salesByCompany} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/>
                  <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={120} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
    </div>
  );
}
