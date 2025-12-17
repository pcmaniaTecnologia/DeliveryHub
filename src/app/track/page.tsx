'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collectionGroup, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackageSearch, Package, ChefHat, Bike, PackageCheck, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type OrderStatus = 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';

type Order = {
  id: string;
  status: OrderStatus;
  orderDate: Timestamp;
  deliveryType: 'Delivery' | 'Retirada';
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
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const firestore = useFirestore();
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      setError('Por favor, insira o ID do pedido.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setOrder(null);
    setSearched(true);

    try {
      const ordersRef = collectionGroup(firestore, 'orders');
      const q = query(ordersRef, where('__name__', '==', orderId.trim()));
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Pedido não encontrado. Verifique o ID e tente novamente.');
      } else {
        const orderDoc = querySnapshot.docs[0];
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;

        // Adjust steps for pickup orders
        if (orderData.deliveryType === 'Retirada') {
            const deliveryStepIndex = statusSteps.findIndex(step => step.status === 'Saiu para entrega');
            if (deliveryStepIndex > -1) {
                statusSteps.splice(deliveryStepIndex, 1);
            }
        }
        
        setOrder(orderData);
      }
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao buscar seu pedido. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusConfig = () => {
    if (!order) return { currentStep: -1, isCancelled: false };
    
    const isCancelled = order.status === 'Cancelado';
    
    let activeSteps = statusSteps;
    if (order.deliveryType === 'Retirada') {
        activeSteps = statusSteps.filter(s => s.status !== 'Saiu para entrega');
    } else {
        activeSteps = statusSteps.filter(s => s.status !== 'Pronto para retirada');
    }

    const statusMap: OrderStatus[] = [
        'Novo', 
        'Aguardando pagamento', 
        'Em preparo', 
        order.deliveryType === 'Delivery' ? 'Saiu para entrega' : 'Pronto para retirada',
        'Entregue'
    ];
    
    let currentStep = statusMap.indexOf(order.status);

    if (order.status === 'Aguardando pagamento') currentStep = 0;
    if (order.status === 'Pronto para retirada' && order.deliveryType === 'Delivery') currentStep = 2; // Should not happen but as fallback

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
                Digite o ID do seu pedido para ver o status atual.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-grow grid gap-2">
                  <Label htmlFor="order-id" className="sr-only">ID do Pedido</Label>
                  <Input
                    id="order-id"
                    placeholder="Cole o ID do pedido aqui"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Buscando...' : 'Buscar Pedido'}
                </Button>
              </form>
            </CardContent>
         </Card>

        {searched && !isLoading && (
            <div className="mt-8">
              {order && (
                <Card>
                  <CardHeader>
                    <CardTitle>Status do Pedido #{order.id.substring(0, 6).toUpperCase()}</CardTitle>
                     <CardDescription>
                        {isCancelled 
                            ? "Este pedido foi cancelado."
                            : `Seu pedido está ${order.status.toLowerCase()}.`
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
