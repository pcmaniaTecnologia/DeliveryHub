
'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, QrCode } from 'lucide-react';
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

type Table = {
  id: string;
  name: string;
};

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [tableName, setTableName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddTable = () => {
    if (!tableName.trim()) return;
    const newTable: Table = {
      id: `mesa-${Date.now()}`,
      name: tableName,
    };
    setTables([...tables, newTable]);
    setTableName('');
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Comandas de Mesa</CardTitle>
            <CardDescription>
              Gerencie os pedidos feitos diretamente nas mesas do seu estabelecimento.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
        {tables.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.map((table) => (
              <Card key={table.id} className="flex flex-col items-center justify-center p-4">
                <CardTitle className="text-lg">{table.name}</CardTitle>
                <CardDescription>Status: Livre</CardDescription>
                <Button variant="outline" size="sm" className="mt-4 gap-2">
                  <QrCode className="h-4 w-4" />
                  Imprimir QR Code
                </Button>
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
  );
}
