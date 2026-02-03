
'use client';

import { useState, useEffect } from 'react';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, updateDocument } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Plan = {
  id: string;
  name: string;
  price: number;
  productLimit: number;
  orderLimit: number;
  duration: 'monthly' | 'annual';
};

const planFormSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  price: z.coerce.number().min(0, { message: 'O preço não pode ser negativo.' }),
  productLimit: z.coerce.number().int().min(0, { message: 'O limite de produtos deve ser 0 ou mais.' }),
  orderLimit: z.coerce.number().int().min(0, { message: 'O limite de pedidos deve ser 0 ou mais.' }),
  duration: z.enum(['monthly', 'annual'], { required_error: 'A duração é obrigatória.' }),
});

export default function PlansPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const form = useForm<z.infer<typeof planFormSchema>>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: '',
      price: 0,
      productLimit: 100,
      orderLimit: 500,
      duration: 'monthly',
    },
  });

  useEffect(() => {
    if (editingPlan) {
      form.reset(editingPlan);
    } else {
      form.reset({
        name: '',
        price: 0,
        productLimit: 100,
        orderLimit: 500,
        duration: 'monthly',
      });
    }
  }, [editingPlan, form]);

  const plansRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'plans');
  }, [firestore]);

  const { data: plans, isLoading: isLoadingPlans } = useCollection<Plan>(plansRef);

  const onSubmit = (values: z.infer<typeof planFormSchema>) => {
    let promise;
    if (editingPlan) {
      if (!firestore) return;
      const planDocRef = doc(firestore, 'plans', editingPlan.id);
      promise = updateDocument(planDocRef, values);
    } else {
      if (!plansRef) return;
      promise = addDocument(plansRef, values);
    }

    promise.then(() => {
      toast({
        title: editingPlan ? 'Plano Atualizado!' : 'Plano Criado!',
        description: `O plano ${values.name} foi salvo com sucesso.`,
      });
      form.reset();
      setIsDialogOpen(false);
      setEditingPlan(null);
    });
  };

  const handleDeletePlan = (planId: string, planName: string) => {
    if (!firestore || !user) return;
    const planDocRef = doc(firestore, 'plans', planId);
    deleteDocument(planDocRef).then(() => {
        toast({
            title: 'Plano Excluído',
            description: `O plano ${planName} foi removido com sucesso.`,
            variant: 'destructive'
        });
    });
  };
  
  const handleOpenDialog = (plan: Plan | null = null) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };
  
  const isLoading = isUserLoading || isLoadingPlans;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Planos de Assinatura</CardTitle>
            <CardDescription>Gerencie os planos disponíveis para as empresas.</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
            <PlusCircle className="h-4 w-4" />
            Adicionar Plano
          </Button>
        </div>
      </CardHeader>
      <CardContent>
         <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
            setIsDialogOpen(isOpen);
            if (!isOpen) setEditingPlan(null);
         }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Editar Plano' : 'Adicionar Novo Plano'}</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes do plano de assinatura.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nome do Plano</FormLabel><FormControl><Input placeholder="Ex: Básico" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem><FormLabel>Preço (R$)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="29.90" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="productLimit" render={({ field }) => (
                      <FormItem><FormLabel>Limite de Produtos (0 para ilimitado)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="orderLimit" render={({ field }) => (
                      <FormItem><FormLabel>Limite de Pedidos/mês (0 para ilimitado)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="duration" render={({ field }) => (
                      <FormItem><FormLabel>Duração</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <FormControl><SelectTrigger><SelectValue placeholder="Selecione a duração" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <DialogFooter>
                     <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                    <Button type="submit">Salvar Plano</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Limite de Produtos</TableHead>
              <TableHead>Limite de Pedidos</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center">Carregando planos...</TableCell></TableRow>
            )}
            {!isLoading && plans?.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>R${plan.price.toFixed(2)}</TableCell>
                <TableCell>{plan.productLimit === 0 ? 'Ilimitado' : plan.productLimit}</TableCell>
                <TableCell>{plan.orderLimit === 0 ? 'Ilimitado' : plan.orderLimit}</TableCell>
                <TableCell>{plan.duration === 'monthly' ? 'Mensal' : 'Anual'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Menu de Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenDialog(plan)}>Editar</DropdownMenuItem>
                        <AlertDialog>
                           <AlertDialogTrigger asChild>
                            <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive hover:bg-destructive/10 w-full">
                                Excluir
                             </div>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita. Isso excluirá permanentemente o plano.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePlan(plan.id, plan.name)} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {!isLoading && plans?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center">Nenhum plano encontrado.</TableCell></TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
