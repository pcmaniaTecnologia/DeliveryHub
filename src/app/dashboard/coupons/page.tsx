
'use client';

import { useState } from 'react';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, deleteDocument } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';

type Coupon = {
  id: string;
  companyId: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  validUntilDate?: string;
  usageLimit?: number;
  usageCount?: number; // To track usage
  isActive: boolean;
};

const couponFormSchema = z.object({
  name: z.string().min(3, { message: 'O código deve ter pelo menos 3 caracteres.' }),
  type: z.enum(['percentage', 'fixed'], { required_error: 'O tipo é obrigatório.' }),
  value: z.coerce.number().positive({ message: 'O valor deve ser positivo.' }),
  validUntilDate: z.string().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
});

export default function CouponsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof couponFormSchema>>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      name: '',
      type: 'percentage',
      value: 0,
      validUntilDate: '',
    },
  });

  const couponsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, `companies/${user.uid}/coupons`);
  }, [firestore, user?.uid]);

  const { data: coupons, isLoading: isLoadingCoupons } = useCollection<Coupon>(couponsRef);

  const onSubmit = async (values: z.infer<typeof couponFormSchema>) => {
    if (!user || !couponsRef) return;

    const newCoupon = {
      ...values,
      companyId: user.uid,
      isActive: true,
      usageCount: 0,
    };

    try {
      await addDocument(couponsRef, newCoupon);
      toast({
        title: 'Cupom Adicionado!',
        description: `O cupom ${values.name} foi criado com sucesso.`,
      });
      form.reset();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to add coupon:", error);
      // Firebase permission errors are handled globally
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!firestore || !user) return;
    const couponDocRef = doc(firestore, `companies/${user.uid}/coupons/${couponId}`);
    try {
      await deleteDocument(couponDocRef);
      toast({
        title: 'Cupom Excluído',
        description: 'O cupom foi removido com sucesso.',
        variant: 'destructive'
      });
    } catch (error) {
      console.error("Failed to delete coupon:", error);
       toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível remover o cupom.',
      });
    }
  };

  const getCouponStatus = (coupon: Coupon): { text: string; variant: 'default' | 'destructive' | 'secondary' } => {
    if (!coupon.isActive) {
      return { text: 'Inativo', variant: 'secondary' };
    }
    if (coupon.validUntilDate && new Date(coupon.validUntilDate) < new Date()) {
      return { text: 'Expirado', variant: 'destructive' };
    }
    if (coupon.usageLimit && (coupon.usageCount ?? 0) >= coupon.usageLimit) {
        return { text: 'Esgotado', variant: 'destructive' };
    }
    return { text: 'Ativo', variant: 'default' };
  };
  
  const isLoading = isUserLoading || (couponsRef && isLoadingCoupons);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cupons de Desconto</CardTitle>
            <CardDescription>Crie e gerencie seus cupons promocionais.</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                Adicionar Cupom
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cupom</DialogTitle>
                <DialogDescription>Preencha os detalhes do seu novo cupom.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Código</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: BEMVINDO10" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Tipo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                           <FormControl>
                            <SelectTrigger className="col-span-3">
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                            <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Valor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="10.00" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="validUntilDate"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Validade</FormLabel>
                        <FormControl>
                          <Input type="date" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="usageLimit"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">Limite de uso</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="100" className="col-span-3" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-4 pl-[calc(25%+1rem)]" />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit">Salvar Cupom</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Carregando cupons...</TableCell>
              </TableRow>
            )}
            {!isLoading && coupons?.map((coupon) => {
              const status = getCouponStatus(coupon);
              return (
              <TableRow key={coupon.id}>
                <TableCell className="font-medium">{coupon.name}</TableCell>
                <TableCell>{coupon.type === 'percentage' ? 'Porcentagem' : 'Fixo'}</TableCell>
                <TableCell>{coupon.type === 'percentage' ? `${coupon.value}%` : `R$${coupon.value.toFixed(2)}`}</TableCell>
                <TableCell>{`${coupon.usageCount ?? 0} / ${coupon.usageLimit ?? '∞'}`}</TableCell>
                <TableCell>{coupon.validUntilDate ? format(new Date(coupon.validUntilDate), 'dd/MM/yyyy') : 'Sem limite'}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.text}</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem disabled>Editar</DropdownMenuItem>
                      <DropdownMenuItem disabled>Desativar</DropdownMenuItem>
                       <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-destructive hover:bg-destructive/10">
                                Excluir
                             </div>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o cupom.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCoupon(coupon.id)} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
             {!isLoading && coupons?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Nenhum cupom encontrado.</TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{coupons?.length ?? 0}</strong> de <strong>{coupons?.length ?? 0}</strong> cupons
        </div>
      </CardFooter>
    </Card>
  );
}

    