'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, updateDocument, deleteDocument } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Trash2, Plus, Bike, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';

type Courier = {
  id: string;
  name: string;
  phone: string;
  pinCode: string;
  active: boolean;
  deliveryRate?: number;
};

export default function CouriersPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  
  // Formulário
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [active, setActive] = useState(true);
  const [deliveryRate, setDeliveryRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const couriersRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, `companies/${user.uid}/couriers`), orderBy('name'));
  }, [firestore, user?.uid]);

  const { data: couriers, isLoading } = useCollection<Courier>(couriersRef);

  const handleOpenDialog = (courier?: Courier) => {
    if (courier) {
      setEditingCourier(courier);
      setName(courier.name);
      setPhone(courier.phone);
      setPinCode(courier.pinCode);
      setActive(courier.active ?? true);
      setDeliveryRate(courier.deliveryRate?.toString() || '');
    } else {
      setEditingCourier(null);
      setName('');
      setPhone('');
      setPinCode(Math.floor(1000 + Math.random() * 9000).toString()); // Gera PIN de 4 dígitos
      setActive(true);
      setDeliveryRate('');
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !user) return;
    if (!name || !phone || !pinCode) {
      toast({ title: 'Erro', description: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const courierData = {
        name,
        phone,
        pinCode,
        active,
        deliveryRate: parseFloat(deliveryRate) || 0,
      };

      if (editingCourier) {
        const ref = doc(firestore, `companies/${user.uid}/couriers`, editingCourier.id);
        await updateDocument(ref, courierData);
        toast({ title: 'Entregador atualizado!' });
      } else {
        const ref = collection(firestore, `companies/${user.uid}/couriers`);
        await addDocument(ref, courierData);
        toast({ title: 'Entregador adicionado!' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !user) return;
    if (confirm('Tem certeza que deseja excluir este entregador?')) {
      try {
        const ref = doc(firestore, `companies/${user.uid}/couriers`, id);
        await deleteDocument(ref);
        toast({ title: 'Entregador excluído!' });
      } catch (error) {
        toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
      }
    }
  };

  if (isUserLoading || isLoading) return <LoadingScreen />;

  const appLink = typeof window !== 'undefined' ? `${window.location.origin}/entregador/${user?.uid}` : '';

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Bike className="h-8 w-8" />
            Entregadores (Motoboys)
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie sua frota própria de entregadores.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Adicionar Entregador
        </Button>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Link do Portal dos Entregadores</CardTitle>
          <CardDescription>Envie este link para os seus entregadores acessarem pelo celular deles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input readOnly value={appLink} className="bg-background" />
            <Button variant="secondary" onClick={() => {
                navigator.clipboard.writeText(appLink);
                toast({ title: 'Link copiado!' });
            }}>Copiar</Button>
            <Button variant="outline" asChild>
                <a href={appLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregadores Cadastrados</CardTitle>
          <CardDescription>Estes são os motoboys que podem receber os pedidos despachados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>PIN de Acesso</TableHead>
                <TableHead>Valor/Entrega</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum entregador cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                couriers?.map((courier) => (
                  <TableRow key={courier.id}>
                    <TableCell className="font-medium">{courier.name}</TableCell>
                    <TableCell>{courier.phone}</TableCell>
                    <TableCell><code className="bg-muted px-2 py-1 rounded">{courier.pinCode}</code></TableCell>
                    <TableCell>R$ {courier.deliveryRate?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${courier.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {courier.active ? 'Ativo' : 'Inativo'}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(courier)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(courier.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCourier ? 'Editar Entregador' : 'Adicionar Entregador'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Entregador</Label>
              <Input id="name" placeholder="Ex: João Silva" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp / Telefone</Label>
              <Input id="phone" placeholder="Ex: 33988887777" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (Senha de Acesso)</Label>
              <Input id="pin" placeholder="Ex: 1234" value={pinCode} onChange={(e) => setPinCode(e.target.value)} disabled={isSaving} />
              <p className="text-xs text-muted-foreground">O entregador usará o telefone e este PIN para entrar no painel dele.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryRate">Valor Fixo por Entrega (R$)</Label>
              <Input id="deliveryRate" type="number" step="0.01" placeholder="Ex: 5.00" value={deliveryRate} onChange={(e) => setDeliveryRate(e.target.value)} disabled={isSaving} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="active" className="cursor-pointer">Entregador Ativo</Label>
              <Switch id="active" checked={active} onCheckedChange={setActive} disabled={isSaving} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
