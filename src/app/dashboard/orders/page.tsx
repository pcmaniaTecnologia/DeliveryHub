'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, updateDocument, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, type Timestamp } from 'firebase/firestore';
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
import { MoreHorizontal, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { generateOrderPrintHtml } from '@/lib/print-utils';


type Company = {
    id: string;
    name: string;
    soundNotificationEnabled: boolean;
    autoPrintEnabled: boolean;
    whatsappMessageTemplates?: string;
};

type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  finalPrice?: number;
  notes?: string;
  productName?: string;
  selectedVariants?: { groupName: string; itemName: string; price: number }[];
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
  customerName?: string;
  customerPhone?: string;
};


const statusMap: { [key: string]: Order['status'][] } = {
  "Todos": ["Novo", "Aguardando pagamento", "Em preparo", "Pronto para retirada", "Saiu para entrega", "Entregue", "Cancelado"],
  "Novo": ["Novo", "Aguardando pagamento"],
  "Em preparo": ["Em preparo"],
  "Pronto": ["Pronto para retirada", "Saiu para entrega"],
  "Finalizados": ["Entregue", "Cancelado"],
}

export default function OrdersPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

    const handleUpdateStatus = (order: Order, status: Order['status']) => {
        if (!firestore || !user || !companyData) return;
        const orderDocRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
        const newStatus = { status };

        updateDocument(orderDocRef, newStatus).then(async () => {
            toast({
                title: 'Status do Pedido Atualizado!',
                description: `O pedido foi marcado como "${status}".`,
            });
            
            const templates = companyData.whatsappMessageTemplates ? JSON.parse(companyData.whatsappMessageTemplates) : {};
            let messageTemplate = '';
            
            switch (status) {
                case 'Em preparo':
                    messageTemplate = templates.received || "Olá {cliente}, seu pedido nº {pedido_id} foi recebido e já estamos preparando tudo! 🍔";
                    break;
                case 'Saiu para entrega':
                    messageTemplate = templates.delivery || "Boas notícias, {cliente}! Seu pedido nº {pedido_id} acabou de sair para entrega! 🛵";
                    break;
                case 'Pronto para retirada':
                    messageTemplate = templates.ready || "Ei, {cliente}! Seu pedido nº {pedido_id} está pronto para retirada. 😊";
                    break;
                default:
                    return; 
            }

            if (!order.customerPhone) return;
            
            const message = messageTemplate
                .replace('{cliente}', order.customerName || 'Cliente')
                .replace('{pedido_id}', order.id.substring(0, 6).toUpperCase());

            const whatsappUrl = `https://wa.me/55${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, 'whatsapp_window');

        }).catch(serverError => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderDocRef.path,
                operation: 'update',
                requestResourceData: newStatus,
            }));
        });
    };
    
    const isLoading = isUserLoading || isLoadingOrders || isLoadingCompany;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Pedidos</CardTitle>
        <CardDescription>Gerencie seus pedidos em tempo real.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="Todos">
          <TabsList className="grid w-full grid-cols-5">
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
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                     {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>
                      ) : (
                      orders?.filter(order => statuses.includes(order.status)).sort((a, b) => b.orderDate.toMillis() - a.orderDate.toMillis()).map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.id.substring(0, 6).toUpperCase()}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell><Badge>{order.status}</Badge></TableCell>
                          <TableCell className="text-right">R${order.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => setSelectedOrder(order)}>Ver Detalhes</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Em preparo')}>Mudar para Preparo</DropdownMenuItem>
                                {order.deliveryType === 'Delivery' ? (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Saiu para entrega')}>Saiu para Entrega</DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Pronto para retirada')}>Pronto para Retirada</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Entregue')}>Finalizar/Entregue</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Cancelado')} className="text-destructive">Cancelar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
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
       <OrderDetailsDialog 
            order={selectedOrder} 
            company={companyData || undefined}
            onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}
        />
    )}
    </>
  );
}

const OrderDetailsDialog = ({ order, company, onOpenChange }: { order: Order; company?: Company; onOpenChange: (isOpen: boolean) => void; }) => {
    const firestore = useFirestore();
    const { user } = useUser();

     const handlePrint = () => {
        if (!order || !firestore || !user) return;
        const printHtml = generateOrderPrintHtml(order, company);
        const printWindow = window.open('', '_blank', 'width=300,height=500');
        if (printWindow) {
            printWindow.document.write(printHtml);
            printWindow.document.close();
        }

        if (order.status === 'Novo' || order.status === 'Aguardando pagamento') {
            const orderRef = doc(firestore, `companies/${user.uid}/orders`, order.id);
            updateDocument(orderRef, { status: 'Em preparo' }).catch(() => {});
        }
    };

    const subtotal = order.totalAmount - (order.deliveryFee || 0);

    return (
        <Dialog open={!!order} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Pedido #{order.id.substring(0, 6).toUpperCase()}</DialogTitle></DialogHeader>
                <div className="p-4 space-y-4">
                    <div className="text-center">
                        <h2 className="text-xl font-bold">{company?.name}</h2>
                        <p className="text-xs text-muted-foreground">{order.orderDate.toDate().toLocaleString()}</p>
                    </div>
                    <Separator />
                    <div className="text-sm">
                        <p><strong>Cliente:</strong> {order.customerName}</p>
                        <p><strong>Tel:</strong> {order.customerPhone}</p>
                        <p><strong>Endereço:</strong> {order.deliveryAddress}</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        {order.orderItems.map((item, idx) => {
                            const groupedVariants: { [key: string]: { name: string; price: number }[] } = {};
                            if (item.selectedVariants) {
                                item.selectedVariants.forEach(v => {
                                    if (!groupedVariants[v.groupName]) groupedVariants[v.groupName] = [];
                                    groupedVariants[v.groupName].push({ name: v.itemName, price: v.price });
                                });
                            }

                            return (
                                <div key={idx} className="text-sm">
                                    <div className="flex justify-between font-medium">
                                        <span>{item.quantity}x {item.productName}</span>
                                        <span>R${(item.finalPrice || item.unitPrice).toFixed(2)}</span>
                                    </div>
                                    {Object.entries(groupedVariants).map(([group, items], vIdx) => (
                                        <p key={vIdx} className="text-xs text-muted-foreground ml-2">
                                            • <strong>{group}:</strong> {items.map(i => `${i.name}${i.price > 0 ? ` (+R$${i.price.toFixed(2)})` : ''}`).join(', ')}
                                        </p>
                                    ))}
                                    {item.notes && <p className="text-xs italic text-muted-foreground ml-2">Obs: {item.notes}</p>}
                                </div>
                            );
                        })}
                    </div>
                    <Separator />
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>R$ {subtotal.toFixed(2)}</span>
                        </div>
                        {order.deliveryFee && order.deliveryFee > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Taxa de Entrega</span>
                                <span>R$ {order.deliveryFee.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2">
                            <span>Total</span>
                            <span>R$ {order.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                 <DialogFooter>
                    <Button variant="outline" className="w-full" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir e Começar Preparo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
