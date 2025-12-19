
'use client';

import { useState } from 'react';
import { MoreHorizontal, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocument, deleteDocument } from '@/firebase';
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
import { Switch } from '@/components/ui/switch';


type Company = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  subscriptionEndDate?: any; 
};


export default function ManageCompaniesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const companiesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'companies');
  }, [firestore]);

  const { data: companies, isLoading: isLoadingCompanies } = useCollection<Company>(companiesRef);

  const handleToggleActive = async (companyId: string, currentStatus: boolean) => {
    if (!firestore) return;
    const companyDocRef = doc(firestore, 'companies', companyId);
    try {
      await updateDocument(companyDocRef, { isActive: !currentStatus });
      toast({
        title: 'Status da Empresa Atualizado!',
        description: `A empresa foi ${!currentStatus ? 'ativada' : 'desativada'}.`,
      });
    } catch (error) {
      console.error("Failed to toggle company status:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status da empresa.',
      });
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!firestore) return;
    // Note: This only deletes the company document. Deleting all sub-collections (products, orders, etc.)
    // should ideally be handled by a Firebase Cloud Function for atomicity and completeness.
    const companyDocRef = doc(firestore, 'companies', companyId);
    try {
      await deleteDocument(companyDocRef);
      toast({
        title: 'Empresa Excluída',
        description: 'A empresa foi removida com sucesso. Sub-coleções podem precisar de exclusão manual ou via script.',
        variant: 'destructive'
      });
    } catch (error) {
      console.error("Failed to delete company:", error);
       toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a empresa.',
      });
    }
  };
  
  const isLoading = isUserLoading || isLoadingCompanies;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Empresas</CardTitle>
        <CardDescription>Visualize, ative, desative ou exclua as lojas da plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Validade da Assinatura</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Carregando empresas...</TableCell>
              </TableRow>
            )}
            {!isLoading && companies?.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.phone || 'Não informado'}</TableCell>
                <TableCell>
                  {company.subscriptionEndDate ? format(company.subscriptionEndDate.toDate(), 'dd/MM/yyyy') : 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge variant={company.isActive ? 'default' : 'destructive'}>
                    {company.isActive ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                         <Switch
                            checked={company.isActive}
                            onCheckedChange={(checked) => handleToggleActive(company.id, !checked)}
                            aria-label={`Ativar ou desativar ${company.name}`}
                        />
                        <AlertDialog>
                           <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                               </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir {company.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente a empresa e seus dados associados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCompany(company.id)} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </TableCell>
              </TableRow>
            ))}
             {!isLoading && companies?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Nenhuma empresa encontrada.</TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
