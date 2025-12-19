
'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collectionGroup, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackageSearch, Package, ChefHat, Bike, PackageCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type OrderStatus = 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';

type Order = {
  id: string;
  status: OrderStatus;
  orderDate: Timestamp;
  deliveryType: 'Delivery' | 'Retirada';
  totalAmount: number;
};

const statusSteps: { status: OrderStatus, label: string, icon: React.ElementType }[] = [
    { status: 'Novo', label: 'Recebido', icon: Package },
    { status: 'Aguardando pagamento', label: 'Pagamento', icon: Package },
    { status: 'Em preparo', label: 'Em Preparo', icon: ChefHat },
    { status: 'Saiu para entrega', label: 'Em Rota', icon: Bike },
    { status: 'Pronto para retirada', label: 'Para Retirada', icon: PackageCheck },
    { status: 'Entregue', label: 'Entregue', icon: PackageCheck },
];

export default function TrackOrderPage() {
  const [customerName, setCustomerName] = useState('');
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Por favor, insira o seu nome.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setFoundOrders([]);
    setSelectedOrder(null);
    setSearched(true);

    try {
      const ordersRef = collectionGroup(firestore, 'orders');
      const q = query(
        ordersRef, 
        where('customerName', '==', customerName.trim()),
        orderBy('orderDate', 'desc'),
        limit(10) // Limit to last 10 orders for performance
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Nenhum pedido encontrado para este nome. Verifique se o nome está correto.');
      } else {
        const orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setFoundOrders(orders);
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao buscar seus pedidos. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = () => {
    if (!selectedOrder) return { currentStep: -1, isCancelled: false, activeSteps: [] };
    
    const isCancelled = selectedOrder.status === 'Cancelado';
    
    let activeSteps = statusSteps;
    if (selectedOrder.deliveryType === 'Retirada') {
        activeSteps = statusSteps.filter(s => s.status !== 'Saiu para entrega');
    } else {
        activeSteps = statusSteps.filter(s => s.status !== 'Pronto para retirada');
    }

    const statusMap: OrderStatus[] = [
        'Novo', 
        'Aguardando pagamento', 
        'Em preparo', 
        selectedOrder.deliveryType === 'Delivery' ? 'Saiu para entrega' : 'Pronto para retirada',
        'Entregue'
    ];
    
    let currentStep = statusMap.indexOf(selectedOrder.status);

    if (selectedOrder.status === 'Aguardando pagamento') currentStep = 0;
    if (selectedOrder.status === 'Pronto para retirada' && selectedOrder.deliveryType === 'Delivery') currentStep = 2; // Fallback

    return { currentStep, isCancelled, activeSteps };
  };

  const { currentStep, isCancelled, activeSteps } = getStatusConfig();


  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
       <div className="mx-auto max-w-2xl">
         <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <PackageSearch className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="mt-4">Acompanhe seu Pedido</CardTitle>
              <CardDescription>
                Digite seu nome para ver o status dos seus pedidos recentes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-grow grid gap-2">
                  <Label htmlFor="customer-name" className="sr-only">Seu Nome</Label>
                  <Input
                    id="customer-name"
                    placeholder="Digite seu nome completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Buscando...' : 'Buscar Pedidos'}
                </Button>
              </form>
            </CardContent>
         </Card>

        {searched && !isLoading && (
            <div className="mt-8 space-y-4">
              {foundOrders.length > 0 && !selectedOrder && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pedidos Encontrados</CardTitle>
                        <CardDescription>Selecione um pedido para ver os detalhes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {foundOrders.map(order => (
                                <button key={order.id} onClick={() => setSelectedOrder(order)} className="w-full text-left">
                                    <div className="border p-4 rounded-lg hover:bg-muted transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="font-semibold">Pedido de {order.orderDate.toDate().toLocaleDateString('pt-BR')}</div>
                                            <div className="text-sm">R$ {order.totalAmount.toFixed(2)}</div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">Status: {order.status}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
              )}

              {selectedOrder && (
                <Card>
                  <CardHeader>
                    <CardTitle>Status do Pedido #{selectedOrder.id.substring(0, 6).toUpperCase()}</CardTitle>
                     <CardDescription>
                        {isCancelled 
                            ? "Este pedido foi cancelado."
                            : `Seu pedido está ${selectedOrder.status.toLowerCase()}.`
                        }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isCancelled ? (
                         <div className="flex flex-col items-center justify-center text-center text-destructive p-8">
                            <AlertCircle className="h-12 w-12 mb-4" />
                            <p className="font-semibold">Pedido Cancelado</p>
                        </div>
                    ) : (
                      <div className="relative flex justify-between">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 w-full bg-muted">
                           <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(currentStep / (activeSteps.length - 1)) * 100}%` }}></div>
                        </div>
                        {activeSteps.map((step, index) => (
                           <div key={step.label} className="z-10 flex flex-col items-center gap-2 text-center">
                              <div className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full border-2',
                                index <= currentStep ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/30 text-muted-foreground'
                              )}>
                                <step.icon className="h-5 w-5" />
                              </div>
                              <p className={cn(
                                  'text-xs sm:text-sm font-semibold',
                                  index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                              )}>
                                {step.label}
                                </p>
                           </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                   <CardFooter>
                      <Button variant="outline" onClick={() => setSelectedOrder(null)}>Voltar para a lista</Button>
                  </CardFooter>
                </Card>
              )}
              {error && (
                <Card className="border-destructive">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center text-destructive">
                        <AlertCircle className="h-10 w-10 mb-2" />
                        <p className="font-semibold">{error}</p>
                    </CardContent>
                </Card>
              )}
            </div>
        )}
       </div>
       <div className="mt-8 text-center">
         {companyId && (
            <Link href={`/menu/${companyId}`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Cardápio
              </Button>
            </Link>
        )}
       </div>
        <footer className="mt-12 border-t py-6">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                <p>&copy; {new Date().getFullYear()} DeliveryHub. Todos os direitos reservados.</p>
                <p className="mt-1">
                    Desenvolvido por <a href="#" className="underline">PC MANIA</a>
                </p>
            </div>
        </footer>
    </div>
  );
}
