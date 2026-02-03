
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BellRing, Clock, DollarSign, PlusCircle, Trash2, Copy, Printer, Crown, AlertTriangle, CheckCircle, Send } from 'lucide-react';
import { useFirestore, useDoc, setDocument, useMemoFirebase, useUser, useCollection, addDocument, deleteDocument, updateDocument, useAuth } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type PaymentMethods = {
  cash: boolean;
  pix: boolean;
  credit: boolean;
  debit: boolean;
  cashAskForChange: boolean;
};

type DayHours = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type BusinessHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

type WhatsAppTemplates = {
    received: string;
    delivery: string;
    ready: string;
};

type DeliveryZone = {
  id: string;
  neighborhood: string;
  deliveryFee: number;
  deliveryTime: number;
  isActive: boolean;
};

type Plan = {
    id: string;
    name: string;
    price: number;
    productLimit: number;
    orderLimit: number;
    duration: 'monthly' | 'annual';
}

type PlatformSettings = {
    pixKey?: string;
};

// --- Subscription View Component ---
const SubscriptionView = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const plansRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'plans');
    }, [firestore]);
    const { data: plans, isLoading: isLoadingPlans } = useCollection<Plan>(plansRef);

    const platformSettingsRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'platform_settings', 'main');
    }, [firestore]);
    const { data: platformSettings, isLoading: isLoadingSettings } = useDoc<PlatformSettings>(platformSettingsRef);

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    const handleSelectPlan = (plan: Plan) => {
        setSelectedPlan(plan);
    };

    const handleCopyPixKey = () => {
        if (platformSettings?.pixKey) {
            navigator.clipboard.writeText(platformSettings.pixKey);
            toast({ title: "Chave PIX copiada!" });
        }
    };
    
    if (isLoadingPlans || isLoadingSettings) {
        return <p>Carregando planos de assinatura...</p>
    }

    if (!selectedPlan) {
        return (
            <div className="space-y-6">
                 <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight">Escolha seu Plano</h2>
                    <p className="text-muted-foreground mt-2">Selecione o plano que melhor se adapta ao seu negócio para começar a vender.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans?.map((plan) => (
                        <Card key={plan.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Crown className="text-primary"/> {plan.name}</CardTitle>
                                <p className="text-4xl font-bold">R${plan.price}<span className="text-lg font-normal text-muted-foreground">/{plan.duration === 'monthly' ? 'mês' : 'ano'}</span></p>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-2 text-muted-foreground">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> {plan.productLimit === 0 ? 'Produtos ilimitados' : `${plan.productLimit} produtos`}</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> {plan.orderLimit === 0 ? 'Pedidos ilimitados' : `${plan.orderLimit} pedidos/mês`}</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Painel de gerenciamento</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Cardápio online</li>
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleSelectPlan(plan)}>Selecionar Plano</Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

     return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight">Finalizar Pagamento</h2>
                <p className="text-muted-foreground mt-2">Para ativar sua loja, realize o pagamento via PIX.</p>
            </div>
            <Card className="max-w-lg mx-auto">
                <CardHeader>
                    <CardTitle>Pagamento via PIX</CardTitle>
                    <CardDescription>Você selecionou o plano: <span className="font-bold text-primary">{selectedPlan.name}</span></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center border p-4 rounded-lg">
                        <span className="text-lg">Total a pagar:</span>
                        <span className="text-2xl font-bold">R${selectedPlan.price.toFixed(2)}</span>
                    </div>
                    <div>
                        <Label>Chave PIX para pagamento:</Label>
                        <div className="flex items-center gap-2 mt-1">
                            <Input value={platformSettings?.pixKey || 'Chave não configurada'} readOnly />
                            <Button variant="outline" size="icon" onClick={handleCopyPixKey}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                     <Alert>
                        <Send className="h-4 w-4" />
                        <AlertTitle>Próximos Passos</AlertTitle>
                        <AlertDescription>
                            Após realizar o pagamento, por favor, aguarde. Sua conta será ativada manualmente pela administração assim que o pagamento for confirmado.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" onClick={() => setSelectedPlan(null)}>Voltar e escolher outro plano</Button>
                </CardFooter>
            </Card>
        </div>
    )
}

// --- Main Settings Page Component ---
export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading: isUserLoadingAuth } = useUser();
  const auth = useAuth();
  const router = useRouter();

  // Dialog state for adding new delivery zone
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newFee, setNewFee] = useState('');
  const [newTime, setNewTime] = useState('');


  const companyRef = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return doc(firestore, 'companies', user.uid)
  }, [firestore, user]);
  
  const { data: companyData, isLoading: isLoadingCompany } = useDoc(companyRef);

  const deliveryZonesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies', user.uid, 'deliveryZones');
  }, [firestore, user]);

  const { data: deliveryZones, isLoading: isLoadingZones } = useCollection<DeliveryZone>(deliveryZonesRef);
  
  const planRef = useMemoFirebase(() => {
    if (!firestore || !companyData?.planId) return null;
    return doc(firestore, 'plans', companyData.planId);
  }, [firestore, companyData?.planId]);

  const { data: planData, isLoading: isLoadingPlan } = useDoc<Plan>(planRef);


  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#29ABE2');
  const [accentColor, setAccentColor] = useState('#29E2D1');
  const [soundNotificationEnabled, setSoundNotificationEnabled] = useState(true);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [averagePrepTime, setAveragePrepTime] = useState(30);
  const [menuLink, setMenuLink] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>({
    cash: true,
    pix: true,
    credit: true,
    debit: false,
    cashAskForChange: false,
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    tuesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    wednesday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    thursday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    friday: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
    saturday: { isOpen: false, openTime: '', closeTime: '' },
    sunday: { isOpen: false, openTime: '', closeTime: '' },
  });

  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsAppTemplates>({
      received: 'Olá {cliente}, seu pedido nº {pedido_id} foi recebido e já estamos preparando tudo! 🍔',
      delivery: 'Boas notícias, {cliente}! Seu pedido nº {pedido_id} acabou de sair para entrega e logo chegará até você! 🛵',
      ready: 'Ei, {cliente}! Seu pedido nº {pedido_id} está prontinho te esperando para retirada. 😊',
  });

  useEffect(() => {
    if (companyData) {
      setStoreName(companyData.name || '');
      setPhone(companyData.phone || '');
      setSoundNotificationEnabled(companyData.soundNotificationEnabled ?? true);
      setAutoPrintEnabled(companyData.autoPrintEnabled ?? false);
      setClosedMessage(companyData.closedMessage || '');
      setAveragePrepTime(companyData.averagePrepTime || 30);
      if (companyData.themeColors) {
        try {
          const colors = JSON.parse(companyData.themeColors);
          setPrimaryColor(colors.primary || '#29ABE2');
          setAccentColor(colors.accent || '#29E2D1');
        } catch (e) {
          console.error("Error parsing theme colors", e);
        }
      }
       if (companyData.paymentMethods) {
        setPaymentMethods(companyData.paymentMethods);
      }
       if (companyData.businessHours) {
        try {
          const hours = JSON.parse(companyData.businessHours);
          setBusinessHours(hours);
        } catch (e) {
          console.error("Error parsing business hours", e);
        }
      }
      if (companyData.whatsappMessageTemplates) {
          try {
              const templates = JSON.parse(companyData.whatsappMessageTemplates);
              setWhatsappTemplates(templates);
          } catch(e) {
               console.error("Error parsing whatsapp templates", e);
          }
      }
    }
  }, [companyData]);

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      setMenuLink(`${window.location.origin}/menu/${user.uid}`);
    }
  }, [user?.uid]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(menuLink);
    toast({
      title: 'Link Copiado!',
      description: 'O link do cardápio foi copiado para a área de transferência.',
    });
  };

  const handleSaveChanges = () => {
    if (!companyRef || !user) return;

    const themeColors = JSON.stringify({
        primary: primaryColor,
        accent: accentColor,
    });

    const updatedData = {
        name: storeName,
        phone: phone,
        themeColors: themeColors,
        ownerId: user.uid,
        soundNotificationEnabled: soundNotificationEnabled,
        autoPrintEnabled: autoPrintEnabled,
        closedMessage: closedMessage,
        averagePrepTime: averagePrepTime,
    };

    updateDocument(companyRef, updatedData).then(() => {
        toast({
            title: 'Sucesso!',
            description: 'As configurações da sua empresa foram salvas.',
        });
    });
  };

  const handlePaymentMethodChange = (method: keyof Omit<PaymentMethods, 'cashAskForChange'>, checked: boolean) => {
    setPaymentMethods(prev => ({ ...prev, [method]: checked }));
  };

  const handleCashAskForChange = (checked: boolean) => {
    setPaymentMethods(prev => ({ ...prev, cashAskForChange: checked }));
  };

  const handleSavePayments = () => {
    if (!companyRef) return;
    updateDocument(companyRef, { paymentMethods }).then(() => {
        toast({
            title: 'Sucesso!',
            description: 'Métodos de pagamento salvos.',
        });
    });
  };
  
    const handleHoursChange = (day: keyof BusinessHours, field: keyof DayHours, value: string | boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      }
    }));
  };

  const handleSaveHours = () => {
    if (!companyRef) return;
    const businessHoursString = JSON.stringify(businessHours);
    updateDocument(companyRef, { businessHours: businessHoursString }).then(() => {
        toast({
            title: 'Sucesso!',
            description: 'Horários de funcionamento salvos.',
        });
    });
  };

  const handleAddZone = () => {
    if (!deliveryZonesRef || !newNeighborhood || !newFee || !newTime) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
      });
      return;
    }

    const newZone = {
      neighborhood: newNeighborhood,
      deliveryFee: parseFloat(newFee),
      deliveryTime: parseInt(newTime, 10),
      isActive: true,
      companyId: user?.uid,
    };

    addDocument(deliveryZonesRef, newZone).then(() => {
        toast({
            title: 'Sucesso!',
            description: `Bairro ${newNeighborhood} adicionado.`,
        });
        // Reset form and close dialog
        setNewNeighborhood('');
        setNewFee('');
        setNewTime('');
        setIsZoneDialogOpen(false);
    });
  };
  
  const handleDeleteZone = (zoneId: string) => {
    if (!firestore || !user) return;
    const zoneRef = doc(firestore, 'companies', user.uid, 'deliveryZones', zoneId);
    deleteDocument(zoneRef).then(() => {
        toast({
            title: 'Sucesso!',
            description: 'Bairro removido.',
        });
    });
  };

  const handleZoneIsActiveChange = (zone: DeliveryZone, isActive: boolean) => {
    if (!firestore || !user) return;
    const zoneRef = doc(firestore, 'companies', user.uid, 'deliveryZones', zone.id);
    updateDocument(zoneRef, { isActive });
  }

  const handleSaveMessages = () => {
    if (!companyRef) return;
    const whatsappTemplatesString = JSON.stringify(whatsappTemplates);
    updateDocument(companyRef, { whatsappTemplates: whatsappTemplatesString }).then(() => {
        toast({
            title: 'Sucesso!',
            description: 'Mensagens do WhatsApp salvas.',
        });
    });
  };

  const handleDeleteStore = () => {
    if (!companyRef || !user || !auth) {
        toast({
            variant: 'destructive',
            title: 'Erro',
            description: 'Não foi possível identificar a empresa ou autenticação. Faça login novamente.',
        });
        return;
    }

    // This is a simplified example. For a real app, use a Cloud Function
    // to recursively delete all subcollections (products, orders, etc.).
    deleteDocument(companyRef).then(() => {
        toast({
            title: 'Loja Excluída',
            description: 'Sua loja e seus dados foram excluídos. Você será desconectado.',
        });
        
        // Log the user out and redirect to home page
        if (auth) {
          auth.signOut();
        }
        router.push('/');
    });
};

  const isLoading = isUserLoadingAuth || isLoadingCompany || isLoadingZones || isLoadingPlan;

  const weekDays: { key: keyof BusinessHours; label: string }[] = [
    { key: 'sunday', label: 'Domingo' },
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
  ];

  if (isLoading) {
    return <p>Carregando configurações...</p>
  }
  
  if (companyData && companyData.isActive === false) {
    return <SubscriptionView />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua loja e conta.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="profile">Empresa</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="notifications">Mensagens</TabsTrigger>
          <TabsTrigger value="subscription">Assinatura</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Perfil da Empresa</CardTitle>
              <CardDescription>
                Atualize as informações e a aparência da sua loja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="store-name">Nome da Loja</Label>
                <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logomarca</Label>
                <Input id="logo" type="file" disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone/WhatsApp</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isLoading}/>
              </div>
               <div className="space-y-2">
                <Label htmlFor="average-prep-time">Tempo médio de preparo (minutos)</Label>
                <Input id="average-prep-time" type="number" value={averagePrepTime} onChange={(e) => setAveragePrepTime(Number(e.target.value))} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closed-message">Mensagem de loja fechada</Label>
                <Textarea id="closed-message" value={closedMessage} onChange={(e) => setClosedMessage(e.target.value)} placeholder="Estamos fechados no momento, mas abriremos amanhã às 9h!" disabled={isLoading} />
              </div>
              <Separator />
               <div className="space-y-2">
                <Label htmlFor="menu-link">Link do Cardápio</Label>
                <div className="flex items-center gap-2">
                  <Input id="menu-link" value={menuLink} readOnly disabled={isLoading} />
                  <Button variant="outline" size="icon" onClick={handleCopyToClipboard} disabled={isLoading}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Compartilhe este link com seus clientes para que eles possam ver seu cardápio.</p>
              </div>
              <Separator />
               <div className="space-y-4">
                 <Label className="text-base">Notificações e Impressão</Label>
                 <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="font-medium" htmlFor="sound-notification">Ativar notificação sonora para novos pedidos</Label>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Um som será reproduzido sempre que um novo pedido chegar.
                      </p>
                    </div>
                    <Switch
                      id="sound-notification"
                      checked={soundNotificationEnabled}
                      onCheckedChange={setSoundNotificationEnabled}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="font-medium" htmlFor="auto-print">Impressão automática de pedidos</Label>
                       <p className="text-[0.8rem] text-muted-foreground">
                        Abre a janela de impressão automaticamente para novos pedidos.
                      </p>
                    </div>
                    <Switch
                      id="auto-print"
                      checked={autoPrintEnabled}
                      onCheckedChange={setAutoPrintEnabled}
                      disabled={isLoading}
                    />
                  </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-base">Aparência</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="primary-color">Primária</Label>
                    <Input id="primary-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-14 p-1" disabled={isLoading} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accent-color">Destaque</Label>
                    <Input id="accent-color" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-14 p-1" disabled={isLoading} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveChanges} disabled={isLoading || companyData?.isActive === false}>
                {isLoading ? 'Carregando...' : 'Salvar Alterações'}
              </Button>
            </CardFooter>
          </Card>
          <Card className="mt-6 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
              <CardDescription>
                Ações irreversíveis. Tenha muito cuidado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Excluir esta loja</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Isso excluirá permanentemente sua loja,
                      junto com todos os produtos, pedidos e dados de clientes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteStore}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Sim, excluir minha loja
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Horário de Funcionamento</CardTitle>
              <CardDescription>
                Defina os dias e horários que sua loja estará aberta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weekDays.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={businessHours[key]?.isOpen}
                      onCheckedChange={(checked) => handleHoursChange(key, 'isOpen', checked)}
                      id={`switch-${key}`}
                      disabled={isLoading || companyData?.isActive === false}
                    />
                    <Label htmlFor={`switch-${key}`} className="w-24">{label}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={businessHours[key]?.openTime}
                      onChange={(e) => handleHoursChange(key, 'openTime', e.target.value)}
                      disabled={!businessHours[key]?.isOpen || isLoading || companyData?.isActive === false}
                      className="w-32"
                    />
                    <span>às</span>
                    <Input
                      type="time"
                      value={businessHours[key]?.closeTime}
                      onChange={(e) => handleHoursChange(key, 'closeTime', e.target.value)}
                      disabled={!businessHours[key]?.isOpen || isLoading || companyData?.isActive === false}
                      className="w-32"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveHours} disabled={isLoading || companyData?.isActive === false}>
                {isLoading ? 'Carregando...' : 'Salvar Horários'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>


        <TabsContent value="delivery">
          <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Entregas e Frete</CardTitle>
                    <CardDescription>
                      Configure suas taxas e áreas de entrega.
                    </CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1" disabled={isLoading || companyData?.isActive === false}>
                      <PlusCircle className="h-4 w-4" />
                      Adicionar Bairro
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bairro</TableHead>
                      <TableHead>
                        <DollarSign className="inline-block h-4 w-4 mr-1" />
                        Taxa
                      </TableHead>
                      <TableHead>
                        <Clock className="inline-block h-4 w-4 mr-1" />
                        Tempo
                      </TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={5} className="text-center">Carregando...</TableCell></TableRow>}
                    {!isLoading && deliveryZones?.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">
                          {zone.neighborhood}
                        </TableCell>
                        <TableCell>R${zone.deliveryFee.toFixed(2)}</TableCell>
                        <TableCell>{zone.deliveryTime} min</TableCell>
                        <TableCell>
                          <Switch 
                            checked={zone.isActive}
                            onCheckedChange={(checked) => handleZoneIsActiveChange(zone, checked)}
                            disabled={isLoading || companyData?.isActive === false}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteZone(zone.id)} disabled={isLoading || companyData?.isActive === false}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                     {!isLoading && deliveryZones?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">Nenhum bairro adicionado.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Bairro</DialogTitle>
                <DialogDescription>
                  Preencha os dados da nova área de entrega.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="neighborhood" className="text-right">
                    Bairro
                  </Label>
                  <Input
                    id="neighborhood"
                    value={newNeighborhood}
                    onChange={(e) => setNewNeighborhood(e.target.value)}
                    className="col-span-3"
                    placeholder="Ex: Centro"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fee" className="text-right">
                    Taxa (R$)
                  </Label>
                  <Input
                    id="fee"
                    type="number"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    className="col-span-3"
                    placeholder="5.00"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="time" className="text-right">
                    Tempo (min)
                  </Label>
                  <Input
                    id="time"
                    type="number"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="col-span-3"
                    placeholder="30"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsZoneDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddZone}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens do WhatsApp</CardTitle>
              <CardDescription>
                Personalize as mensagens automáticas enviadas aos clientes. Use {'{cliente}'} e {'{pedido_id}'} como variáveis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msg-received">Pedido Recebido / Em Preparo</Label>
                <Textarea
                  id="msg-received"
                  value={whatsappTemplates.received}
                  onChange={(e) => setWhatsappTemplates(p => ({...p, received: e.target.value}))}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-delivery">Saiu para Entrega</Label>
                <Textarea
                  id="msg-delivery"
                  value={whatsappTemplates.delivery}
                  onChange={(e) => setWhatsappTemplates(p => ({...p, delivery: e.target.value}))}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-ready">Pronto para Retirada</Label>
                <Textarea
                  id="msg-ready"
                  value={whatsappTemplates.ready}
                  onChange={(e) => setWhatsappTemplates(p => ({...p, ready: e.target.value}))}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveMessages} disabled={isLoading || companyData?.isActive === false}>Salvar Mensagens</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pagamento</CardTitle>
              <CardDescription>
                Ative os métodos de pagamento que sua loja aceita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-cash" className="flex-grow">
                    Dinheiro
                  </Label>
                  <Switch 
                    id="payment-cash" 
                    checked={paymentMethods.cash} 
                    onCheckedChange={(c) => handlePaymentMethodChange('cash', c)}
                    disabled={isLoading || companyData?.isActive === false}
                  />
                </div>
                {paymentMethods.cash && (
                  <div className="flex items-center space-x-2 pl-2 pt-2 border-t mt-2">
                    <Checkbox 
                      id="ask-for-change" 
                      checked={paymentMethods.cashAskForChange}
                      onCheckedChange={(c) => handleCashAskForChange(c as boolean)}
                      disabled={isLoading || companyData?.isActive === false}
                    />
                    <Label htmlFor="ask-for-change" className="text-sm font-normal">
                      Perguntar se o cliente precisa de troco
                    </Label>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-pix" className="flex-grow">
                  PIX
                </Label>
                <Switch 
                  id="payment-pix" 
                  checked={paymentMethods.pix} 
                  onCheckedChange={(c) => handlePaymentMethodChange('pix', c)}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-credit" className="flex-grow">
                  Cartão de Crédito
                </Label>
                <Switch 
                  id="payment-credit" 
                  checked={paymentMethods.credit} 
                  onCheckedChange={(c) => handlePaymentMethodChange('credit', c)}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-debit" className="flex-grow">
                  Cartão de Débito
                </Label>
                <Switch 
                  id="payment-debit"
                  checked={paymentMethods.debit} 
                  onCheckedChange={(c) => handlePaymentMethodChange('debit', c)}
                  disabled={isLoading || companyData?.isActive === false}
                />
              </div>
            </CardContent>
             <CardFooter>
              <Button onClick={handleSavePayments} disabled={isLoading || companyData?.isActive === false}>
                 {isLoading ? 'Carregando...' : 'Salvar Pagamentos'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
         <TabsContent value="subscription">
            <Card>
                <CardHeader>
                    <CardTitle>Plano e Assinatura</CardTitle>
                    <CardDescription>Visualize os detalhes do seu plano atual.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingPlan && <p>Carregando seu plano...</p>}
                    {!isLoadingPlan && planData && (
                        <div className="space-y-4">
                             <p>Plano Atual: <span className="font-bold text-primary">{planData.name}</span></p>
                             <p>Sua assinatura é válida até: <span className="font-bold">{companyData?.subscriptionEndDate ? format(companyData.subscriptionEndDate.toDate(), 'dd/MM/yyyy') : 'N/A'}</span></p>
                        </div>
                    )}
                     {!isLoadingPlan && !planData && (
                        <p>Você não está inscrito em nenhum plano no momento.</p>
                     )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
