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
import { MoreHorizontal, Package, Printer, Truck, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Order = {
  id: string;
  customer: string;
  date: string;
  status: 'Entregue' | 'Saiu para entrega' | 'Em preparo' | 'Aguardando pagamento' | 'Novo' | 'Cancelado' | 'Pronto para retirada';
  total: string;
  deliveryType: 'Delivery' | 'Retirada';
};

const orders: Order[] = [
  { id: 'ORD001', customer: 'Liam Johnson', date: '2023-11-23', status: 'Entregue', total: 'R$250.00', deliveryType: 'Delivery' },
  { id: 'ORD002', customer: 'Olivia Smith', date: '2023-11-23', status: 'Saiu para entrega', total: 'R$150.00', deliveryType: 'Delivery' },
  { id: 'ORD003', customer: 'Noah Williams', date: '2023-11-24', status: 'Em preparo', total: 'R$350.00', deliveryType: 'Retirada' },
  { id: 'ORD004', customer: 'Emma Brown', date: '2023-11-24', status: 'Aguardando pagamento', total: 'R$450.00', deliveryType: 'Delivery' },
  { id: 'ORD005', customer: 'Liam Johnson', date: '2023-11-25', status: 'Novo', total: 'R$550.00', deliveryType: 'Retirada' },
  { id: 'ORD006', customer: 'Ava Jones', date: '2023-11-25', status: 'Cancelado', total: 'R$200.00', deliveryType: 'Delivery' },
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
            <DialogContent className="sm:max-w-md print:shadow-none print:border-none">
                <div id="print-content">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido: {order.id}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <p><strong>Cliente:</strong> {order.customer}</p>
                        <p><strong>Data:</strong> {order.date}</p>
                        <p><strong>Status:</strong> {order.status}</p>
                        <p><strong>Tipo:</strong> {order.deliveryType}</p>
                        <p><strong>Total:</strong> {order.total}</p>
                    </div>
                </div>
                <DialogFooter className="print:hidden">
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
                                <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
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
