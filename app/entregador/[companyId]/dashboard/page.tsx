'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, updateDocument } from '@/firebase';
import { collection, query, where, onSnapshot, doc, Timestamp, orderBy, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bike, LogOut, MapPin, CheckCircle2, Navigation, AlertCircle, HandCoins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Order = {
  id: string;
  customerName?: string;
  deliveryAddress: string;
  deliveryFee?: number;
  paymentMethod: string;
  notes?: string;
  courierId?: string;
  courierStatus?: 'pending' | 'accepted' | 'picked_up' | 'delivered';
  orderDate: Timestamp;
};

export default function CourierDashboard({ params }: { params: { companyId: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [courier, setCourier] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Authentication check
  useEffect(() => {
    const saved = localStorage.getItem(`courier_${params.companyId}`);
    if (saved) {
      setCourier(JSON.parse(saved));
    } else {
      router.push(`/entregador/${params.companyId}`);
    }
  }, [params.companyId, router]);

  // Audio initialization
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  // Realtime listeners
  useEffect(() => {
    if (!firestore || !courier?.id) return;

    // Listen for Pending Orders
    const pendingQuery = query(
      collection(firestore, `companies/${params.companyId}/orders`),
      where('courierStatus', '==', 'pending')
    );

    const unsubscribePending = onSnapshot(pendingQuery, (snapshot) => {
      const orders: Order[] = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() } as Order));
      
      // Check if there are NEW pending orders to play sound
      if (orders.length > availableOrders.length && audioRef.current) {
         audioRef.current.play().catch(() => console.log('Audio blocked by browser'));
      }
      
      setAvailableOrders(orders);
    });

    // Listen for My Active Orders
    const myActiveQuery = query(
      collection(firestore, `companies/${params.companyId}/orders`),
      where('courierId', '==', courier.id),
      where('courierStatus', 'in', ['accepted', 'picked_up'])
    );

    const unsubscribeActive = onSnapshot(myActiveQuery, (snapshot) => {
      const orders: Order[] = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() } as Order));
      setMyOrders(orders);
    });

    return () => {
      unsubscribePending();
      unsubscribeActive();
    };
  }, [firestore, courier?.id, params.companyId]);

  // Fetch today's completed deliveries
  useEffect(() => {
    if (!firestore || !courier?.id) return;
    
    const fetchTodayStats = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(firestore, `companies/${params.companyId}/orders`),
        where('courierId', '==', courier.id),
        where('courierStatus', '==', 'delivered'),
        where('orderDate', '>=', Timestamp.fromDate(today))
      );
      
      const snapshot = await getDocs(q);
      setTodayCount(snapshot.size);
      let total = 0;
      snapshot.forEach(doc => {
          const data = doc.data() as Order;
          total += (data.deliveryFee || 0);
      });
      setTodayEarnings(total);
    };

    fetchTodayStats();
    // Re-fetch every 5 mins or rely on state update after delivery
  }, [firestore, courier?.id, params.companyId, myOrders.length]);

  const handleLogout = () => {
    localStorage.removeItem(`courier_${params.companyId}`);
    router.push(`/entregador/${params.companyId}`);
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!firestore || !courier) return;
    try {
      const orderRef = doc(firestore, `companies/${params.companyId}/orders`, orderId);
      await updateDocument(orderRef, {
        courierId: courier.id,
        courierName: courier.name,
        courierStatus: 'accepted',
        courierAcceptedAt: Timestamp.now()
      });
      toast({ title: 'Corrida Aceita!', description: 'Vá até o restaurante buscar o pedido.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Outro entregador pode ter aceitado antes.', variant: 'destructive' });
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!firestore) return;
    try {
      const orderRef = doc(firestore, `companies/${params.companyId}/orders`, orderId);
      await updateDocument(orderRef, {
        courierStatus: 'delivered',
        status: 'Entregue', // Muda o status real do pedido para Entregue também
        courierDeliveredAt: Timestamp.now()
      });
      toast({ title: 'Entrega Finalizada!', description: 'Bom trabalho.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Não foi possível finalizar.', variant: 'destructive' });
    }
  };

  const openMap = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  if (!courier) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-full">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg leading-none">Olá, {courier.name}</p>
              <p className="text-xs text-primary-foreground/80">Entregador</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-white/20">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6">
        
        {/* Painel de Ganhos Rápidos */}
        <div className="grid grid-cols-2 gap-4">
            <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <HandCoins className="w-6 h-6 text-green-600 mb-1" />
                    <p className="text-xs text-green-800 font-medium">Ganhos Hoje</p>
                    <p className="text-xl font-bold text-green-700">R$ {todayEarnings.toFixed(2)}</p>
                </CardContent>
            </Card>
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mb-1" />
                    <p className="text-xs text-blue-800 font-medium">Entregas Hoje</p>
                    <p className="text-xl font-bold text-blue-700">{todayCount}</p>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active" className="relative">
              Minhas Entregas
              {myOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {myOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="radar" className="relative">
              Radar (Novas)
              {availableOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground animate-bounce">
                  {availableOrders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {myOrders.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center border-2 border-dashed rounded-xl">
                <Bike className="w-12 h-12 mb-2 opacity-20" />
                <p>Nenhuma entrega em andamento.</p>
                <p className="text-sm">Vá para o Radar para pegar corridas.</p>
              </div>
            ) : (
              myOrders.map(order => (
                <Card key={order.id} className="border-l-4 border-l-blue-500 shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Pedido #{order.id.substring(0,6).toUpperCase()}</CardTitle>
                        <CardDescription className="font-medium text-foreground">{order.customerName}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">Taxa: R$ {order.deliveryFee?.toFixed(2) || '0.00'}</p>
                        <p className="text-xs text-muted-foreground">Pagamento: {order.paymentMethod}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2 text-sm">
                    <div className="flex gap-2 items-start bg-muted/50 p-2 rounded-lg mb-2">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="leading-tight">{order.deliveryAddress}</span>
                    </div>
                    {order.notes && (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                        <strong>Obs do pedido:</strong> {order.notes}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 bg-white" onClick={() => openMap(order.deliveryAddress)}>
                      <Navigation className="w-4 h-4 mr-2 text-blue-500" /> Waze/Maps
                    </Button>
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleCompleteOrder(order.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Entreguei
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="radar" className="space-y-4">
            {availableOrders.length === 0 ? (
               <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                 <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                 <p>Nenhum pedido novo no momento.</p>
                 <p className="text-sm">Fique atento, logo sai uma entrega!</p>
               </div>
            ) : (
              availableOrders.map(order => (
                <Card key={order.id} className="border-t-4 border-t-amber-500 shadow-md animate-in slide-in-from-bottom-4">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">Novo Chamado!</CardTitle>
                        <CardDescription>Bairro: {order.deliveryAddress.split(',')[1] || 'Endereço completo abaixo'}</CardDescription>
                      </div>
                      <div className="text-right bg-green-100 px-3 py-1 rounded-full">
                        <p className="text-sm font-bold text-green-700">R$ {order.deliveryFee?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                     <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                       {order.deliveryAddress}
                     </p>
                     <Button className="w-full text-lg h-12 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleAcceptOrder(order.id)}>
                       ACEITAR CORRIDA
                     </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
