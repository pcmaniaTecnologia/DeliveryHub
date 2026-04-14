'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument, updateDocument } from '@/firebase';
import { collection, doc, deleteField } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Plan = {
  id: string;
  name: string;
  price: number;
  productLimit: number;
  orderLimit: number;
  duration: 'monthly' | 'trial';
  trialDays?: number;  // usado quando duration === 'trial': 5, 7, 15 ou 30
  billingType: 'monthly' | 'per_order';
  pricePerOrder?: number;
};

const planFormSchema = z.object({
  name: z.string().min(3, { message: 'O nome deve ter pelo menos 3 caracteres.' }),
  price: z.coerce.number().min(0, { message: 'O preço não pode ser negativo.' }),
  productLimit: z.coerce.number().int().min(0, { message: 'O limite de produtos deve ser 0 ou mais.' }),
  orderLimit: z.coerce.number().int().min(0, { message: 'O limite de pedidos deve ser 0 ou mais.' }),
  duration: z.enum(['monthly', 'trial'], { required_error: 'A duração é obrigatória.' }),
  trialDays: z.coerce.number().int().optional(), // 5, 7, 15 ou 30 — só usado quando duration === 'trial'
  billingType: z.enum(['monthly', 'per_order']).default('monthly'),
  pricePerOrder: z.coerce.number().min(0).optional(),
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
      trialDays: 7,
      billingType: 'monthly',
      pricePerOrder: 0,
    },
  });

  const billingType = useWatch({ control: form.control, name: 'billingType' });
  const duration = useWatch({ control: form.control, name: 'duration' });

  useEffect(() => {
    if (editingPlan) {
      form.reset({
        name: editingPlan.name,
        price: editingPlan.price,
        productLimit: editingPlan.productLimit,
        orderLimit: editingPlan.orderLimit,
        duration: editingPlan.duration,
        trialDays: editingPlan.trialDays ?? 7,
        billingType: editingPlan.billingType ?? 'monthly',
        pricePerOrder: editingPlan.pricePerOrder ?? 0,
      });
    } else {
      form.reset({
        name: '',
        price: 0,
        productLimit: 100,
        orderLimit: 500,
        duration: 'monthly',
        trialDays: 7,
        billingType: 'monthly',
        pricePerOrder: 0,
      });
    }
  }, [editingPlan, form]);

  const plansRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'plans');
  }, [firestore]);

  const { data: plans, isLoading: isLoadingPlans } = useCollection<Plan>(plansRef);

  const onSubmit = (values: z.infer<typeof planFormSchema>) => {
    const dataToSave = {
      ...values,
      // Per order: keep pricePerOrder; otherwise zero it out
      pricePerOrder: values.billingType === 'per_order' ? (values.pricePerOrder ?? 0) : 0,
      // Trial plans are always free (price = 0)
      price: values.duration === 'trial' ? 0 : values.price,
      // Trial days: use value when trial, or deleteField() to remove it from Firestore (undefined is not allowed)
      trialDays: values.duration === 'trial' ? (values.trialDays ?? 7) : deleteField(),
    };

    let promise;
    if (editingPlan) {
      if (!firestore) return;
      const planDocRef = doc(firestore, 'plans', editingPlan.id);
      promise = updateDocument(planDocRef, dataToSave);
    } else {
      if (!plansRef) return;
      promise = addDocument(plansRef, dataToSave);
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

  const getBillingLabel = (plan: Plan) => {
    if (plan.billingType === 'per_order') {
      return `R$${(plan.pricePerOrder ?? 0).toFixed(2)}/pedido`;
    }
    return plan.duration === 'trial' ? '5 dias (Teste)' : 'Mensal';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Planos de Assinatura</CardTitle>
            <CardDescription>Gerencie os planos disponíveis para as empresas. Suporte a cobrança mensal fixa ou por quantidade de pedidos.</CardDescription>
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

                  {/* Billing Type */}
                  <FormField control={form.control} name="billingType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cobrança</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">💳 Mensalidade Fixa</SelectItem>
                            <SelectItem value="per_order">📦 Por Quantidade de Pedidos</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                  )}/>

                  {/* Conditional fields based on billing type */}
                  {billingType === 'monthly' ? (
                    <>
                      <FormField control={form.control} name="duration" render={({ field }) => (
                          <FormItem><FormLabel>Tipo de Plano</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                               <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="trial">🎁 Período de Teste (Gratuito)</SelectItem>
                                <SelectItem value="monthly">💳 Mensal (Pago)</SelectItem>
                              </SelectContent>
                            </Select>
                          <FormMessage />
                        </FormItem>
                      )}/>

                      {/* Se for plano de teste, mostrar opções de dias */}
                      {duration === 'trial' ? (
                        <FormField control={form.control} name="trialDays" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duração do Período de Teste</FormLabel>
                              <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? 7)}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione os dias" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="5">5 dias</SelectItem>
                                  <SelectItem value="7">7 dias</SelectItem>
                                  <SelectItem value="15">15 dias</SelectItem>
                                  <SelectItem value="30">1 mês (30 dias)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>O período de teste é gratuito — preço será definido como R$0,00.</FormDescription>
                              <FormMessage />
                            </FormItem>
                        )}/>
                      ) : (
                        <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Preço Mensal (R$)</FormLabel>
                              <FormControl><Input type="number" step="0.01" placeholder="29.90" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                        )}/>
                      )}
                    </>
                  ) : (
                    <>
                      <FormField control={form.control} name="pricePerOrder" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preço por Pedido (R$)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="0.50" {...field} /></FormControl>
                            <FormDescription>Valor cobrado por cada pedido realizado pela empresa.</FormDescription>
                            <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={form.control} name="price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Taxa de Ativação (R$) — opcional</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                            <FormDescription>Valor fixo cobrado na adesão ao plano (pode ser 0).</FormDescription>
                            <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={form.control} name="orderLimit" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Limite de Pedidos/mês (0 para ilimitado)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Limite máximo de pedidos incluídos no plano.</FormDescription>
                            <FormMessage />
                          </FormItem>
                      )}/>
                    </>
                  )}

                  <FormField control={form.control} name="productLimit" render={({ field }) => (
                      <FormItem><FormLabel>Limite de Produtos (0 para ilimitado)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
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
              <TableHead>Tipo de Cobrança</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Limite de Produtos</TableHead>
              <TableHead>Limite de Pedidos</TableHead>
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
                <TableCell>
                  {plan.billingType === 'per_order' ? (
                    <Badge variant="secondary">📦 Por Pedido</Badge>
                  ) : plan.duration === 'trial' ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">🎁 Teste Gratuito</Badge>
                  ) : (
                    <Badge variant="outline">💳 Mensal</Badge>
                  )}
                </TableCell>
                <TableCell className="font-semibold">
                  {plan.billingType === 'per_order' ? (
                    <span className="text-blue-600">
                      R${(plan.pricePerOrder ?? 0).toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/pedido</span>
                      {plan.price > 0 && <span className="block text-xs text-muted-foreground">+ R${plan.price.toFixed(2)} ativação</span>}
                    </span>
                  ) : plan.duration === 'trial' ? (
                    <span className="text-green-600 font-bold">
                      Gratuito
                      <span className="block text-xs font-normal text-muted-foreground">
                        por {plan.trialDays === 30 ? '1 mês (30 dias)' : `${plan.trialDays ?? 5} dias`}
                      </span>
                    </span>
                  ) : (
                    <span>R${plan.price.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                  )}
                </TableCell>
                <TableCell>{plan.productLimit === 0 ? 'Ilimitado' : plan.productLimit}</TableCell>
                <TableCell>{plan.orderLimit === 0 ? 'Ilimitado' : plan.orderLimit}</TableCell>
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
