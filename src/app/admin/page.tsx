
'use client';
import { Banknote, Building, DollarSign, PieChart, ShoppingCart } from 'lucide-react';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, collectionGroup, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

type Company = {
    id: string;
    name: string;
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

    const companiesRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'companies');
    }, [firestore]);

    const { data: companies, isLoading: isLoadingCompanies } = useCollection<Company>(companiesRef);

    const [salesData, setSalesData] = useState<CompanySales[]>([]);
    const [isLoadingSales, setIsLoadingSales] = useState(true);

    useEffect(() => {
        const fetchSales = async () => {
            if (!firestore || !companies || companies.length === 0) {
                 if (companies && companies.length === 0) setIsLoadingSales(false);
                return;
            };

            setIsLoadingSales(true);
            
            try {
                const ordersQuery = query(collectionGroup(firestore, 'orders'), where('status', '!=', 'Cancelado'));
                const ordersSnapshot = await getDocs(ordersQuery);
                const allOrders = ordersSnapshot.docs.map(doc => doc.data() as Order);

                const salesByCompany = companies.map(company => {
                    const companyOrders = allOrders.filter(order => order.companyId === company.id);
                    const totalSales = companyOrders.reduce((sum, order) => sum + order.totalAmount, 0);
                    return {
                        name: company.name,
                        Vendas: totalSales,
                    };
                });
                
                setSalesData(salesByCompany);
            } catch (error) {
                 const contextualError = new FirestorePermissionError({
                    operation: 'list',
                    path: 'orders (collectionGroup)',
                });
                errorEmitter.emit('permission-error', contextualError);
            } finally {
                setIsLoadingSales(false);
            }
        };

        fetchSales();
    }, [firestore, companies]);

    const { totalRevenue, totalCompanies, totalOrders } = useMemo(() => {
        if (!salesData || !companies) {
            return { totalRevenue: 0, totalCompanies: 0, totalOrders: 0 };
        }
        const totalRevenue = salesData.reduce((sum, company) => sum + company.Vendas, 0);
        return {
            totalRevenue,
            totalCompanies: companies.length,
            totalOrders: 0, // Note: A full order count would require another query. This is a placeholder.
        };
    }, [salesData, companies]);

    const isLoading = isUserLoading || isLoadingCompanies || isLoadingSales;
    
    if (isLoading) {
        return <p>Carregando dashboard do administrador...</p>;
    }

  return (
    <div className="space-y-6">
       <h2 className="text-3xl font-bold tracking-tight">Dashboard do Administrador</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">de todas as lojas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Lojas</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalCompanies}</div>
             <p className="text-xs text-muted-foreground">lojas ativas e inativas</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">...</div>
            <p className="text-xs text-muted-foreground">contagem de todos os pedidos</p>
          </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Faturamento por Loja</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer>
                <BarChart data={salesData} layout="vertical" margin={{ left: 20, right: 20 }}>
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
