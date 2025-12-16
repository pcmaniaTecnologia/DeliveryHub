
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, updateDoc, type Timestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Package, Printer, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import ReactToPrint from 'react-to-print';

// A valid, short beep sound in Base64 format.
const notificationSound = "data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAhAAAA9/8A/f8E/wMAAgAFAAMACQD0/wD9/w==";


type Company = {
    id: string;
    name: string;
    soundNotificationEnabled: boolean;
    autoPrintEnabled: boolean;
};

type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  productName?: string;
};

export type Order = {
  id: string;
  companyId: string;
  customerId: string;
  orderDate: Timestamp;
  status: 'Novo' | 'Aguardando pagamento' | 'Em preparo' | 'Pronto para retirada' | 'Saiu para entrega' | 'Entregue' | 'Cancelado';
  deliveryAddress: string;
  deliveryType: 'Delivery' | 'Retirada';
  deliveryFee?: number;
  paymentMethod: string;
  estimatedTime?: number;
  orderItems: OrderItem[];
  totalAmount: number;
  notes?: string;
  // For local state, not from Firestore
  customerName?: string; 
};


const statusMap: { [key: string]: Order['status'][] } = {
  "Todos": ["Novo", "Aguardando pagamento", "Em preparo", "Pronto para retirada", "Saiu para entrega", "Entregue", "Cancelado"],
  "Novo": ["Novo", "Aguardando pagamento"],
  "Em preparo": ["Em preparo"],
  "Pronto": ["Pronto para retirada", "Saiu para entrega"],
  "Finalizados": ["Entregue", "Cancelado"],
}

const PrintableOrder = React.forwardRef<HTMLDivElement, { order: Order; company?: Company }>(({ order, company }, ref) => {
    return (
        <div ref={ref} className="p-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold">{company?.name || 'Seu Restaurante'}</h2>
                <p className="text-sm text-gray-500">Pedido: {order.id.substring(0, 6).toUpperCase()}</p>
                <p className="text-sm text-gray-500">{order.orderDate.toDate().toLocaleString('pt-BR')}</p>
            </div>
            <Separator className="my-4" />
            <div className="space-y-4">
                <div className="space-y-1">
                    <h3 className="font-semibold">Cliente</h3>
                    <p>{order.customerName || 'Cliente anônimo'}</p>
                    {order.deliveryType === 'Delivery' && <p className="text-gray-500">{order.deliveryAddress}</p>}
                </div>
                <Separator />
                <div>
                    <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2">Produto</th>
                                <th className="text-center py-2">Qtd.</th>
                                <th className="text-right py-2">Preço</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.orderItems.map((item, index) => (
                                <tr key={index} className="border-b">
                                    <td className="py-2">{item.productName || item.productId}</td>
                                    <td className="text-center py-2">{item.quantity}</td>
                                    <td className="text-right py-2">R${(item.unitPrice * item.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Separator />
                 <div className="space-y-2">
                     <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>R${order.totalAmount.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>R${order.totalAmount.toFixed(2)}</span>
                     </div>
                </div>
                <Separator />
                <div className="space-y-1">
                    <h3 className="font-semibold">Pagamento</h3>
                    <p>Forma de Pagamento: {order.paymentMethod}</p>
                    <p>Tipo de Entrega: {order.deliveryType}</p>
                </div>
            </div>
        </div>
    );
});
PrintableOrder.displayName = 'PrintableOrder';

const PrintTrigger = React.forwardRef<HTMLButtonElement>((props, ref) => {
    return (
        <Button ref={ref}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
    );
});
PrintTrigger.displayName = 'PrintTrigger';


export default function OrdersPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const lastSeenOrderIds = useRef(new Set<string>());

    const companyRef = useMemoFirebase(() => {
      if (!firestore || !user?.uid) return null;
      return doc(firestore, `companies/${user.uid}`);
    }, [firestore, user?.uid]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc<Company>(companyRef);

    const ordersRef = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return collection(firestore, `companies/${user.uid}/orders`);
    }, [firestore, user?.uid]);

    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);

    // Initialize the set of seen orders on first load
    useEffect(() => {
      if (orders && !isLoadingOrders) {
        if (lastSeenOrderIds.current.size === 0) {
            lastSeenOrderIds.current = new Set(orders.map(o => o.id));
        }
      }
    }, [orders, isLoadingOrders]);

    // This effect handles the audio initialization
    useEffect(() => {
        audioRef.current = new Audio(notificationSound);
        audioRef.current.load(); // Pre-load the audio
    }, []);

    // This effect detects new orders and triggers sound/print
    useEffect(() => {
        if (!orders || orders.length === 0 || isLoadingOrders || !companyData || !audioRef.current) {
            return;
        }

        const newOrders = orders.filter(order => order.status === 'Novo' && !lastSeenOrderIds.current.has(order.id));

        if (newOrders.length > 0) {
            const latestNewOrder = newOrders.sort((a, b) => b.orderDate.toMillis() - a.orderDate.toMillis())[0];
            
            // Play sound if enabled
            if (companyData.soundNotificationEnabled) {
                if (audioRef.current.paused) {
                    audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
                }
            }

            // Update the set of seen orders
            newOrders.forEach(o => lastSeenOrderIds.current.add(o.id));
        }

    }, [orders, isLoadingOrders, companyData]);


    const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
        if (!firestore || !user) return;
        const orderDocRef = doc(firestore, `companies/${user.uid}/orders`, orderId);
        try {
            await updateDoc(orderDocRef, { status });
            toast({
                title: 'Status do Pedido Atualizado!',
                description: `O pedido foi marcado como "${status}".`,
            });
        } catch (error) {
            console.error("Failed to update order status:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao atualizar',
                description: 'Não foi possível atualizar o status do pedido.',
            });
        }
    };
    
    const isLoading = isUserLoading || isLoadingOrders || isLoadingCompany;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Pedidos</CardTitle>
        <CardDescription>Gerencie seus pedidos e visualize o status de cada um.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="Todos">
          <TabsList className="print:hidden">
            {Object.keys(statusMap).map(status => (
              <TabsTrigger key={status} value={status}>{status}</TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(statusMap).map(([tabName, statuses]) => (
            <TabsContent key={tabName} value={tabName}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right print:hidden">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                     {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">Carregando pedidos...</TableCell>
                        </TableRow>
                      ) : (
                      orders?.filter(order => statuses.includes(order.status)).sort((a, b) => b.orderDate.toMillis() - a.orderDate.toMillis()).map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="hidden sm:table-cell">
                            <div className="font-medium">{order.id.substring(0, 6).toUpperCase()}</div>
                            <div className="text-xs text-muted-foreground">{order.orderDate.toDate().toLocaleDateString('pt-BR')}</div>
                          </TableCell>
                          <TableCell>{order.customerName || order.customerId.substring(0,10)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {order.deliveryType === 'Delivery' ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                              {order.deliveryType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'Cancelado' ? 'destructive' : 'default'} className="whitespace-nowrap">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">R${order.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right print:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setSelectedOrder(order)}>Ver Detalhes</DropdownMenuItem>
                                <ReactToPrint
                                  trigger={() => (
                                    <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full">
                                      <Printer className="mr-2 h-4 w-4" />
                                      Imprimir
                                    </div>
                                  )}
                                  content={() => printRef.current}
                                  onBeforeGetContent={() => {
                                    return new Promise<void>((resolve) => {
                                        setSelectedOrder(order);
                                        resolve();
                                    });
                                  }}
                                  onAfterPrint={() => setSelectedOrder(null)}
                                />
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Em preparo')}>Em preparo</DropdownMenuItem>
                                {order.deliveryType === 'Delivery' ?
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Saiu para entrega')}>Saiu para entrega</DropdownMenuItem>
                                    :
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Pronto para retirada')}>Pronto para retirada</DropdownMenuItem>
                                }
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Entregue')}>Entregue</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Cancelado')} className="text-destructive">Cancelar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                      )}
                      {!isLoading && orders?.filter(order => statuses.includes(order.status)).length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center">Nenhum pedido encontrado nesta categoria.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
    {selectedOrder && (
        <Dialog open={selectedOrder !== null} onOpenChange={(isOpen) => { if (!isOpen) setSelectedOrder(null) }}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Detalhes do Pedido</DialogTitle>
                </DialogHeader>
                 <div className='max-h-[60vh] overflow-y-auto -mx-6 px-6'>
                    <PrintableOrder order={selectedOrder} company={companyData || undefined} ref={printRef} />
                 </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedOrder(null)}>Fechar</Button>
                     <ReactToPrint
                        content={() => printRef.current}
                        trigger={() => <PrintTrigger />}
                     />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )}
    {/* Hidden component for printing from the dropdown */}
    <div className="hidden">
      {selectedOrder && <PrintableOrder order={selectedOrder} company={companyData || undefined} ref={printRef} />}
    </div>
    </>
  );
}
