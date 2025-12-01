'use client';

import { useState } from 'react';
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

type OrderItem = {
  name: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  customer: string;
  phone: string;
  date: string;
  status: 'Entregue' | 'Saiu para entrega' | 'Em preparo' | 'Aguardando pagamento' | 'Novo' | 'Cancelado' | 'Pronto para retirada';
  total: string;
  deliveryType: 'Delivery' | 'Retirada';
  address: string;
  paymentMethod: string;
  items: OrderItem[];
};

const orders: Order[] = [
  { id: 'ORD001', customer: 'Liam Johnson', phone: '(11) 98765-4321', date: '2023-11-23', status: 'Entregue', total: 'R$35.50', deliveryType: 'Delivery', address: 'Rua das Flores, 123, Apto 4B, São Paulo, SP', paymentMethod: 'Cartão de Crédito', items: [{ name: 'Cheeseburger Clássico', quantity: 1, price: 25.50 }, { name: 'Refrigerante', quantity: 1, price: 5.00 }, { name: 'Batata Frita', quantity: 1, price: 5.00 }] },
  { id: 'ORD002', customer: 'Olivia Smith', phone: '(21) 91234-5678', date: '2023-11-23', status: 'Saiu para entrega', total: 'R$150.00', deliveryType: 'Delivery', address: 'Av. Principal, 456, Centro, Rio de Janeiro, RJ', paymentMethod: 'PIX', items: [{ name: 'Pizza Margherita', quantity: 2, price: 45.00 }, { name: 'Refrigerante 2L', quantity: 1, price: 10.00 }] },
  { id: 'ORD003', customer: 'Noah Williams', phone: '(31) 95555-4444', date: '2023-11-24', status: 'Em preparo', total: 'R$350.00', deliveryType: 'Retirada', address: 'N/A', paymentMethod: 'Dinheiro', items: [{ name: 'Spaghetti Carbonara', quantity: 4, price: 55.90 }] },
  { id: 'ORD004', customer: 'Emma Brown', phone: '(71) 93333-2222', date: '2023-11-24', status: 'Aguardando pagamento', total: 'R$450.00', deliveryType: 'Delivery', address: 'Rua da Praia, 789, Litoral, Salvador, BA', paymentMethod: 'Aguardando', items: [{ name: 'Sushi de Salmão (8pçs)', quantity: 10, price: 28.00 }] },
  { id: 'ORD005', customer: 'Liam Johnson', phone: '(11) 98765-4321', date: '2023-11-25', status: 'Novo', total: 'R$550.00', deliveryType: 'Retirada', address: 'N/A', paymentMethod: 'Cartão de Débito', items: [{ name: 'Salada Caesar', quantity: 5, price: 35.75 }] },
  { id: 'ORD006', customer: 'Ava Jones', phone: '(48) 92222-1111', date: '2023-11-25', status: 'Cancelado', total: 'R$200.00', deliveryType: 'Delivery', address: 'Alameda dos Anjos, 101, Paraíso, Belo Horizonte, MG', paymentMethod: 'PIX', items: [{ name: 'Pizza Margherita', quantity: 4, price: 45.00 }] },
];

const statusMap: { [key: string]: Order['status'][] } = {
  "Todos": ["Novo", "Aguardando pagamento", "Em preparo", "Saiu para entrega", "Pronto para retirada", "Entregue", "Cancelado"],
  "Novo": ["Novo", "Aguardando pagamento"],
  "Em preparo": ["Em preparo"],
  "Pronto": ["Saiu para entrega", "Pronto para retirada"],
  "Finalizados": ["Entregue", "Cancelado"],
}

function OrderPrintPreview({ order, onClose }: { order: Order; onClose: () => void }) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg print:shadow-none print:border-none">
                <div id="print-content">
                    <DialogHeader className="text-center">
                        <DialogTitle className="text-2xl">The Burger Shop</DialogTitle>
                        <p className="text-sm text-muted-foreground">Pedido: {order.id}</p>
                        <p className="text-sm text-muted-foreground">{new Date(order.date).toLocaleString('pt-BR')}</p>
                    </DialogHeader>
                    <Separator className="my-4" />
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="font-semibold">Cliente</h3>
                            <p>{order.customer}</p>
                            <p className="text-muted-foreground">{order.phone}</p>
                            {order.deliveryType === 'Delivery' && <p className="text-muted-foreground">{order.address}</p>}
                        </div>
                        <Separator />
                        <div>
                            <h3 className="font-semibold mb-2">Itens do Pedido</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-center">Qtd.</TableHead>
                                        <TableHead className="text-right">Preço</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.items.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-center">{item.quantity}</TableCell>
                                            <TableCell className="text-right">R${(item.price * item.quantity).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <Separator />
                         <div className="space-y-2">
                             <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>{order.total}</span>
                             </div>
                             <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{order.total}</span>
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
                <DialogFooter className="print:hidden mt-6">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function OrdersPage() {
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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
                      {orders.filter(order => statuses.includes(order.status)).map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="hidden sm:table-cell">
                            <div className="font-medium">{order.id}</div>
                            <div className="text-xs text-muted-foreground">{order.date}</div>
                          </TableCell>
                          <TableCell>{order.customer}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {order.deliveryType === 'Delivery' ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                              {order.deliveryType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.status === 'Cancelado' ? 'destructive' : 'default'} className="whitespace-nowrap">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{order.total}</TableCell>
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
                                <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Imprimir
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
                                <DropdownMenuItem>Em preparo</DropdownMenuItem>
                                <DropdownMenuItem>Saiu para entrega</DropdownMenuItem>
                                <DropdownMenuItem>Entregue</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">Cancelar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
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
        <OrderPrintPreview order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    )}
    </>
  );
}
