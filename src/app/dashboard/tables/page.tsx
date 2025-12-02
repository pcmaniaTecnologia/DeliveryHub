
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  QrCode,
  X,
  Trash2,
  MinusCircle,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, updateDocument } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

type Table = {
  id: string;
  name: string;
  status: 'free' | 'busy';
  orderItems?: OrderItem[];
  total?: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
};

type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export default function TablesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [tableName, setTableName] = useState('');
  const [isAddTableDialogOpen, setIsAddTableDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Firestore Refs
  const tablesRef = useMemoFirebase(() => 
    user ? collection(firestore, `companies/${user.uid}/tables`) : null
  , [firestore, user]);

  const productsRef = useMemoFirebase(() => 
    user ? collection(firestore, `companies/${user.uid}/products`) : null
  , [firestore, user]);

  // Data Hooks
  const { data: tables, isLoading: isLoadingTables } = useCollection<Table>(tablesRef);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  const handleAddTable = async () => {
    if (!tableName.trim() || !tablesRef) return;
    const newTable: Omit<Table, 'id'> = {
      name: tableName,
      status: 'free',
      orderItems: [],
      total: 0,
    };
    try {
      await addDocument(tablesRef, newTable);
      toast({ title: 'Sucesso', description: `Mesa "${tableName}" adicionada.` });
      setTableName('');
      setIsAddTableDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar a mesa.' });
    }
  };

  const handleDeleteTable = async (tableId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening the sheet
    if (!user || !firestore) return;
    const tableDocRef = doc(firestore, `companies/${user.uid}/tables/${tableId}`);
    try {
        await deleteDocument(tableDocRef);
        toast({ variant: 'destructive', title: 'Sucesso', description: 'Mesa removida.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover a mesa.' });
    }
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
  };
  
  const handleAddToOrder = async (product: Product) => {
    if (!selectedTable || !user || !firestore) return;

    const tableDocRef = doc(firestore, `companies/${user.uid}/tables/${selectedTable.id}`);
    
    let updatedOrderItems = [...(selectedTable.orderItems || [])];
    const existingItemIndex = updatedOrderItems.findIndex(item => item.productId === product.id);

    if (existingItemIndex > -1) {
        updatedOrderItems[existingItemIndex].quantity += 1;
    } else {
        updatedOrderItems.push({
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity: 1,
        });
    }

    const newTotal = updatedOrderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    try {
        await updateDocument(tableDocRef, { 
            orderItems: updatedOrderItems,
            total: newTotal,
            status: 'busy',
        });
        // Optimistically update local state for better UX
        setSelectedTable(prev => prev ? { ...prev, orderItems: updatedOrderItems, total: newTotal, status: 'busy' } : null);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível adicionar o item.' });
    }
  };

  const handleRemoveFromOrder = async (productId: string) => {
     if (!selectedTable || !user || !firestore) return;

    const tableDocRef = doc(firestore, `companies/${user.uid}/tables/${selectedTable.id}`);
    
    let updatedOrderItems = [...(selectedTable.orderItems || [])];
    const existingItemIndex = updatedOrderItems.findIndex(item => item.productId === productId);

    if (existingItemIndex > -1) {
        if (updatedOrderItems[existingItemIndex].quantity > 1) {
            updatedOrderItems[existingItemIndex].quantity -= 1;
        } else {
            updatedOrderItems.splice(existingItemIndex, 1);
        }
    }
    
    const newTotal = updatedOrderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const newStatus = updatedOrderItems.length > 0 ? 'busy' : 'free';

    try {
        await updateDocument(tableDocRef, { 
            orderItems: updatedOrderItems,
            total: newTotal,
            status: newStatus,
        });
        setSelectedTable(prev => prev ? { ...prev, orderItems: updatedOrderItems, total: newTotal, status: newStatus } : null);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o item.' });
    }
  };

  const handleClearOrder = async () => {
     if (!selectedTable || !user || !firestore) return;
     const tableDocRef = doc(firestore, `companies/${user.uid}/tables/${selectedTable.id}`);
     try {
        await updateDocument(tableDocRef, { 
            orderItems: [],
            total: 0,
            status: 'free',
        });
        setSelectedTable(prev => prev ? { ...prev, orderItems: [], total: 0, status: 'free' } : null);
        toast({ title: 'Comanda Limpa', description: `A comanda da ${selectedTable.name} foi limpa.` });
     } catch(error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível limpar a comanda.' });
     }
  }
  
  const isLoading = isLoadingTables || isLoadingProducts;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Comandas de Mesa</CardTitle>
              <CardDescription>
                Gerencie os pedidos feitos diretamente nas mesas do seu estabelecimento.
              </CardDescription>
            </div>
            <Dialog open={isAddTableDialogOpen} onOpenChange={setIsAddTableDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-4 w-4" />
                  Adicionar Mesa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Mesa</DialogTitle>
                  <DialogDescription>
                    Digite o nome ou número da mesa.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="table-name" className="text-right">
                      Nome/Nº
                    </Label>
                    <Input
                      id="table-name"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                      className="col-span-3"
                      placeholder="Ex: Mesa 01"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleAddTable}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Carregando mesas...</p>
             </div>
          ) : tables && tables.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.map((table) => (
                <Card key={table.id} onClick={() => handleTableClick(table)} className="cursor-pointer hover:shadow-lg transition-shadow relative">
                  <div className={`absolute top-2 left-2 h-3 w-3 rounded-full ${table.status === 'busy' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteTable(table.id, e)}>
                      <Trash2 className="h-4 w-4"/>
                  </Button>
                  <CardContent className="flex flex-col items-center justify-center p-4 pt-8 text-center">
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                    <CardDescription className="capitalize">{table.status === 'busy' ? 'Ocupada' : 'Livre'}</CardDescription>
                    {table.status === 'busy' && (
                        <p className="font-bold mt-2 text-lg">R$ {table.total?.toFixed(2) ?? '0.00'}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">Nenhuma mesa adicionada. Comece adicionando uma mesa.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Sheet open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col">
          {selectedTable && (
            <>
              <SheetHeader>
                <SheetTitle>Comanda: {selectedTable.name}</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Order Summary */}
                <div className="flex flex-col border-r pr-4">
                   <h3 className="text-lg font-semibold mb-2">Pedido Atual</h3>
                   <ScrollArea className="flex-1">
                    <div className="space-y-2">
                        {selectedTable.orderItems && selectedTable.orderItems.length > 0 ? (
                            selectedTable.orderItems.map(item => (
                                <div key={item.productId} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-sm text-muted-foreground">R$ {item.unitPrice.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFromOrder(item.productId)}>
                                            <MinusCircle className="h-4 w-4" />
                                        </Button>
                                        <span className="font-bold">{item.quantity}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddToOrder(products?.find(p => p.id === item.productId)!)}>
                                             <PlusCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center mt-8">Nenhum item na comanda.</p>
                        )}
                    </div>
                   </ScrollArea>
                   <Separator className="my-4"/>
                   <div className="space-y-2">
                        <div className="flex justify-between font-semibold">
                            <span>Subtotal</span>
                            <span>R$ {selectedTable.total?.toFixed(2) ?? '0.00'}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xl">
                            <span>Total</span>
                            <span>R$ {selectedTable.total?.toFixed(2) ?? '0.00'}</span>
                        </div>
                   </div>
                </div>
                {/* Product List */}
                <div className="flex flex-col">
                  <h3 className="text-lg font-semibold mb-2">Adicionar Produtos</h3>
                  <ScrollArea className="flex-1">
                    <div className="space-y-2">
                      {isLoadingProducts ? <p>Carregando...</p> : products?.filter(p => p.isActive).map(product => (
                        <Card key={product.id} className="p-3 flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{product.name}</p>
                                <p className="text-sm text-muted-foreground">R$ {product.price.toFixed(2)}</p>
                            </div>
                            <Button size="icon" variant="outline" onClick={() => handleAddToOrder(product)}>
                                <Plus className="h-4 w-4"/>
                            </Button>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <SheetFooter className="mt-4">
                 <Button variant="outline" onClick={() => setSelectedTable(null)}>Fechar</Button>
                 <Button variant="destructive" onClick={handleClearOrder} disabled={!selectedTable.orderItems || selectedTable.orderItems.length === 0}>Limpar Comanda</Button>
                 <Button onClick={() => toast({title: "Em breve!", description: "A finalização do pedido será implementada em breve."})}>Registrar Pedido</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
