
'use client';

import { useState } from 'react';
import { MoreHorizontal, Info, Trash2, MessageCircle, Megaphone, Send, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocument, deleteDocument, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, type Timestamp } from 'firebase/firestore';
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
import { format, addDays } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';


type Company = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  subscriptionEndDate?: Timestamp; 
  createdAt?: Timestamp | any;
};


export default function ManageCompaniesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkQueue, setBulkQueue] = useState<{ id: string, name: string, phone: string, sent: boolean }[]>([]);

  const handleStartBulk = () => {
      const queue = companies?.filter(c => c.phone && c.phone.replace(/\D/g, '').length >= 10).map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone!.replace(/\D/g, ''),
          sent: false
      })) || [];
      if (queue.length === 0) return toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma empresa com telefone válido foi encontrada.' });
      setBulkQueue(queue);
  };

  const currentBulkTarget = bulkQueue.find(q => !q.sent);
  const totalSent = bulkQueue.filter(q => q.sent).length;

  const handleSendNextBulk = () => {
      if (!currentBulkTarget) return;
      const message = bulkMessage.replace('{empresa}', currentBulkTarget.name);
      const url = `https://wa.me/55${currentBulkTarget.phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      setBulkQueue(prev => prev.map(q => q.id === currentBulkTarget.id ? { ...q, sent: true } : q));
  };
  
  const handleSendIndividual = (company: Company) => {
      if (!company.phone) return toast({ variant: 'destructive', description: "Telefone não cadastrado." });
      const phone = company.phone.replace(/\D/g, '');
      const url = `https://wa.me/55${phone}`;
      window.open(url, '_blank');
  };

  const companiesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'companies');
  }, [firestore]);

  const { data: companies, isLoading: isLoadingCompanies } = useCollection<Company>(companiesRef);

  const handleToggleActive = (companyId: string, currentStatus: boolean) => {
    if (!firestore) return;
    const companyDocRef = doc(firestore, 'companies', companyId);
    
    const updateData: { isActive: boolean, subscriptionEndDate?: Date } = { 
        isActive: !currentStatus 
    };

    // When activating the company, set a 30-day subscription period.
    if (!currentStatus) {
        updateData.subscriptionEndDate = addDays(new Date(), 30);
    }
    
    updateDocument(companyDocRef, updateData).catch(error => {
       // This will be caught by the global error listener
    });
    
    toast({
        title: 'Status da Empresa Atualizado!',
        description: `A empresa foi ${!currentStatus ? 'ativada' : 'desativada'}. ${!currentStatus ? 'A assinatura é válida por 30 dias.' : ''}`,
    });
  };

  const handleDeleteCompany = (companyId: string) => {
    if (!firestore) return;
    
    const companyDocRef = doc(firestore, 'companies', companyId);
    // The owner's user document is in a subcollection where the userId is the same as the companyId
    const companyUserDocRef = doc(firestore, 'companies', companyId, 'users', companyId);

    toast({
      title: 'Excluindo empresa...',
      description: 'Aguarde enquanto os dados da empresa são removidos.',
    });

    // Deleting the company and user profile docs.
    // The auth user must be deleted manually in the Firebase Console.
    Promise.all([
        deleteDocument(companyDocRef),
        deleteDocument(companyUserDocRef) // Assuming owner uid is the companyId
    ]).then(() => {
        toast({
            title: 'Empresa Excluída!',
            description: 'Para liberar o e-mail para um novo cadastro, exclua o usuário na aba de Autenticação do Firebase Console.',
            variant: 'destructive',
            duration: 10000,
        });
    }).catch(error => {
        // This will be caught by the global error listener
    });
  };
  
  const isLoading = isUserLoading || isLoadingCompanies;

  const filteredCompanies = companies?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <CardTitle>Gerenciar Empresas</CardTitle>
            <CardDescription>Visualize os emails, ative, desative ou exclua as lojas da plataforma.</CardDescription>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar empresa..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <Button onClick={() => setIsBulkOpen(true)} className="gap-2 shadow-sm rounded-full whitespace-nowrap">
                <Megaphone className="h-4 w-4" />
                Comunicado Geral
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertTitle>Entendendo esta lista</AlertTitle>
            <AlertDescription>
                Esta página mostra todas as empresas cadastradas no <strong className="font-semibold">banco de dados (Firestore)</strong>. Se você vê uma empresa aqui, mas não encontra o usuário correspondente na aba "Authentication" do Console do Firebase, significa que a conta de login foi removida, mas os dados da empresa permaneceram. Você pode remover com segurança os dados da empresa desta lista clicando no ícone da lixeira.
            </AlertDescription>
        </Alert>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Empresa</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Data de Assinatura</TableHead>
              <TableHead>Validade da Assinatura</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Carregando empresas...</TableCell>
              </TableRow>
            )}
            {!isLoading && filteredCompanies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.email || 'Não informado'}</TableCell>
                <TableCell>{company.phone || 'Não informado'}</TableCell>
                <TableCell>
                  {company.createdAt?.toDate ? format(company.createdAt.toDate(), 'dd/MM/yyyy') : (company.createdAt ? format(new Date(company.createdAt), 'dd/MM/yyyy') : 'N/A')}
                </TableCell>
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
                        <Button variant="outline" size="icon" onClick={() => handleSendIndividual(company)} title="Enviar Mensagem" className="rounded-full text-green-600 hover:text-green-700 hover:bg-green-50 z-10">
                            <MessageCircle className="h-4 w-4" />
                        </Button>
                         <Switch
                            checked={!!company.isActive}
                            onCheckedChange={() => handleToggleActive(company.id, !!company.isActive)}
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
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente os dados da empresa no <strong>banco de dados (Firestore)</strong>. A conta de <strong>autenticação do usuário (login)</strong> não será afetada e precisará ser removida manually no Firebase Console para liberar o e-mail.
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
             {!isLoading && filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Nenhuma empresa encontrada com essa busca.</TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isBulkOpen} onOpenChange={(open) => {
          setIsBulkOpen(open);
          if (!open) {
              setBulkQueue([]);
              setBulkMessage('');
          }
      }}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Comunicado em Massa</DialogTitle>
                <DialogDescription>
                    Envie mensagens para o WhatsApp de todas as empresas cadastradas. Use <strong>{'{empresa}'}</strong> para inserir o nome da loja na mensagem.
                </DialogDescription>
            </DialogHeader>
            {bulkQueue.length === 0 ? (
                <div className="space-y-4 pt-4">
                    <Textarea 
                        placeholder="Olá, {empresa}! Temos novidades plataforma..." 
                        rows={6}
                        value={bulkMessage}
                        onChange={(e) => setBulkMessage(e.target.value)}
                    />
                    <DialogFooter>
                        <Button onClick={handleStartBulk} disabled={!bulkMessage.trim()} className="w-full gap-2">
                            <Send className="h-4 w-4" />
                            Preparar Disparos
                        </Button>
                    </DialogFooter>
                </div>
            ) : (
                <div className="space-y-4 pt-4">
                    <div className="bg-muted p-4 rounded-lg flex items-center justify-between">
                        <div>
                            <span className="text-sm font-semibold">Progresso dos Envios</span>
                            <div className="text-2xl font-bold text-primary">{totalSent} / {bulkQueue.length}</div>
                        </div>
                        {currentBulkTarget ? (
                            <Button size="lg" onClick={handleSendNextBulk} className="gap-2 animate-bounce">
                                <MessageCircle className="h-5 w-5" />
                                Enviar para {currentBulkTarget.name}
                            </Button>
                        ) : (
                            <Badge variant="default" className="bg-green-600 px-4 py-2">
                                Todos os Envios Concluídos!
                            </Badge>
                        )}
                    </div>
                    
                    <ScrollArea className="h-64 rounded-md border p-4">
                        {bulkQueue.map((q, i) => (
                            <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0 opacity-60">
                                <span className={`text-sm ${q.sent ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                                    {i + 1}. {q.name}
                                </span>
                                <Badge variant={q.sent ? "secondary" : "outline"} className={q.sent ? "bg-green-100 text-green-800" : ""}>
                                    {q.sent ? 'Enviado' : 'Aguardando'}
                                </Badge>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
