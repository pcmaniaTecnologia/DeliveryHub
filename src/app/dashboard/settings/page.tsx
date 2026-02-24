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
import { useFirestore, useDoc, setDocument, useMemoFirebase, useUser, useCollection, addDocument, deleteDocument, updateDocument, useAuth, deleteAuthUser } from '@/firebase';
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
import { format, isAfter } from 'date-fns';
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
    duration: 'monthly' | 'trial';
}

type PlatformSettings = {
    pixKey?: string;
};

const SubscriptionView = ({ isExpired, trialEndDate }: { isExpired?: boolean, trialEndDate?: Date }) => {
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
            <div className="space-y-6 p-4">
                 <div className="text-center max-w-2xl mx-auto space-y-4">
                    {isExpired ? (
                        <Alert variant="destructive" className="bg-destructive/10">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertTitle>Seu período de acesso expirou!</AlertTitle>
                            <AlertDescription>
                                Para continuar vendendo e acessando seu painel, selecione um plano abaixo. Seus dados estão salvos.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="bg-primary/10 p-4 rounded-lg">
                            <h2 className="text-2xl font-bold text-primary">Você está no Período de Teste!</h2>
                            <p className="text-muted-foreground mt-1">Seu acesso gratuito vai até: <strong className="text-foreground">{trialEndDate ? format(trialEndDate, 'dd/MM/yyyy') : '--/--'}</strong></p>
                        </div>
                    )}
                    <h2 className="text-3xl font-bold tracking-tight">Escolha seu Plano</h2>
                    <p className="text-muted-foreground">Selecione o plano que melhor se adapta ao seu negócio para ativar sua loja permanentemente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans?.map((plan) => (
                        <Card key={plan.id} className="flex flex-col border-2 hover:border-primary transition-all">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Crown className="text-primary"/> {plan.name}</CardTitle>
                                <div className="mt-2">
                                    <span className="text-4xl font-bold">R${plan.price.toFixed(2)}</span>
                                    <span className="text-muted-foreground ml-1">
                                        {plan.duration === 'monthly' ? '/mês' : '/5 dias'}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> {plan.productLimit === 0 ? 'Produtos ilimitados' : `${plan.productLimit} produtos`}</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> {plan.orderLimit === 0 ? 'Pedidos ilimitados' : `${plan.orderLimit} pedidos/mês`}</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Painel de gerenciamento completo</li>
                                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Cardápio online personalizado</li>
                                </ul>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleSelectPlan(plan)}>Assinar Agora</Button>
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
                <h2 className="text-3xl font-bold tracking-tight">Finalizar Assinatura</h2>
                <p className="text-muted-foreground mt-2">Ative sua loja agora mesmo realizando o pagamento.</p>
            </div>
            <Card className="max-w-lg mx-auto shadow-xl">
                <CardHeader>
                    <CardTitle>Pagamento via PIX</CardTitle>
                    <CardDescription>Plano selecionado: <span className="font-bold text-primary">{selectedPlan.name}</span></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center border-2 border-primary/20 p-6 rounded-xl bg-primary/5">
                        <span className="text-lg font-medium">Valor da Assinatura:</span>
                        <span className="text-3xl font-bold text-primary">R${selectedPlan.price.toFixed(2)}</span>
                    </div>
                    <div className="space-y-2">
                        <Label>Copie a Chave PIX abaixo:</Label>
                        <div className="flex items-center gap-2">
                            <Input value={platformSettings?.pixKey || 'Chave não configurada'} readOnly className="font-mono" />
                            <Button variant="outline" size="icon" onClick={handleCopyPixKey}><Copy className="h-4 w-4" /></Button>
                        </div>
                    </div>
                     <Alert className="bg-yellow-50 border-yellow-200">
                        <Send className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800 font-bold">Aviso de Ativação</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                            Após o pagamento, sua conta será ativada manualmente pela nossa equipe em até 24 horas. Envie o comprovante para nosso suporte se desejar agilizar!
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button variant="outline" className="w-full" onClick={() => setSelectedPlan(null)}>Escolher outro plano</Button>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading: isUserLoadingAuth } = useUser();
  const auth = useAuth();
  const router = useRouter();

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
    if (!firestore || !companyData?.planId || companyData.planId === 'trial') return null;
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
        soundNotificationEnabled: soundNotificationEnabled,
        autoPrintEnabled: autoPrintEnabled,
        closedMessage: closedMessage,
        averagePrepTime: averagePrepTime,
        ownerId: user.uid,
    };

    setDocument(companyRef, updatedData, { merge: true }).then(() => {
        toast({
            title: 'Perfil Atualizado!',
            description: 'As informações da sua loja foram salvas com sucesso.',
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
    if (!companyRef || !user) return;
    setDocument(companyRef, { paymentMethods, ownerId: user.uid }, { merge: true }).then(() => {
        toast({
            title: 'Pagamentos Salvos!',
            description: 'Suas formas de pagamento foram atualizadas.',
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
    if (!companyRef || !user) return;
    const businessHoursString = JSON.stringify(businessHours);
    setDocument(companyRef, { businessHours: businessHoursString, ownerId: user.uid }, { merge: true }).then(() => {
        toast({
            title: 'Horários Salvos!',
            description: 'Seus horários de funcionamento foram atualizados com sucesso.',
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
        setNewNeighborhood('');
        setNewFee('');
        setNewTime('');
        setIsZoneDialogOpen(false);
    });
  };
  
  const handleDeleteZone = (zoneId: string) => {
    if (!firestore || !user) return;
    const zoneRef = doc(firestore, 'companies', user.uid, 'deliveryZones', zoneId);
    deleteDocument(zoneRef);
  };

  const handleZoneIsActiveChange = (zone: DeliveryZone, isActive: boolean) => {
    if (!firestore || !user) return;
    const zoneRef = doc(firestore, 'companies', user.uid, 'deliveryZones', zone.id);
    updateDocument(zoneRef, { isActive });
  }

  const handleSaveMessages = () => {
    if (!companyRef || !user) return;
    const whatsappTemplatesString = JSON.stringify(whatsappTemplates);
    setDocument(companyRef, { whatsappTemplates: whatsappTemplatesString, ownerId: user.uid }, { merge: true }).then(() => {
        toast({
            title: 'Mensagens Salvas!',
            description: 'Seus modelos de WhatsApp foram atualizados.',
        });
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

  if (isLoading) return <p>Carregando configurações...</p>;
  
  const trialEndDate = companyData?.subscriptionEndDate?.toDate();
  const isTrialExpired = trialEndDate && isAfter(new Date(), trialEndDate);
  const isInactive = companyData?.isActive === false;

  if (isInactive || isTrialExpired) {
    return <SubscriptionView isExpired={isTrialExpired} trialEndDate={trialEndDate} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie sua loja e conta.</p>
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
              <CardDescription>Atualize as informações e a aparência da sua loja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="store-name">Nome da Loja</Label>
                <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={isLoading} />
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
                <Textarea id="closed-message" value={closedMessage} onChange={(e) => setClosedMessage(e.target.value)} placeholder="Estamos fechados no momento..." disabled={isLoading} />
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
              </div>
              <Separator />
               <div className="space-y-4">
                 <Label className="text-base">Notificações e Impressão</Label>
                 <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="font-medium" htmlFor="sound-notification">Ativar campainha para novos pedidos</Label>
                      <p className="text-xs text-muted-foreground">Um som de campainha tocará para cada novo pedido.</p>
                    </div>
                    <Switch id="sound-notification" checked={soundNotificationEnabled} onCheckedChange={setSoundNotificationEnabled} disabled={isLoading} />
                  </div>
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="font-medium" htmlFor="auto-print">Impressão automática de pedidos</Label>
                       <p className="text-xs text-muted-foreground">Abre a janela de impressão automaticamente ao receber um pedido.</p>
                    </div>
                    <Switch id="auto-print" checked={autoPrintEnabled} onCheckedChange={setAutoPrintEnabled} disabled={isLoading} />
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
              <Button onClick={handleSaveChanges} disabled={isLoading}>Salvar Alterações</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Horário de Funcionamento</CardTitle>
              <CardDescription>Defina os horários de abertura.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {weekDays.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Switch checked={businessHours[key]?.isOpen} onCheckedChange={(checked) => handleHoursChange(key, 'isOpen', checked)} id={`switch-${key}`} disabled={isLoading} />
                    <Label htmlFor={`switch-${key}`} className="w-24">{label}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="time" value={businessHours[key]?.openTime} onChange={(e) => handleHoursChange(key, 'openTime', e.target.value)} disabled={!businessHours[key]?.isOpen || isLoading} className="w-32" />
                    <span>às</span>
                    <Input type="time" value={businessHours[key]?.closeTime} onChange={(e) => handleHoursChange(key, 'closeTime', e.target.value)} disabled={!businessHours[key]?.isOpen || isLoading} className="w-32" />
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveHours} disabled={isLoading}>Salvar Horários</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Áreas de Entrega</CardTitle>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1"><PlusCircle className="h-4 w-4" /> Adicionar Bairro</Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && deliveryZones?.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">{zone.neighborhood}</TableCell>
                        <TableCell>R${zone.deliveryFee.toFixed(2)}</TableCell>
                        <TableCell>{zone.deliveryTime} min</TableCell>
                        <TableCell><Switch checked={zone.isActive} onCheckedChange={(checked) => handleZoneIsActiveChange(zone, checked)} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteZone(zone.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Bairro</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <Input placeholder="Bairro" value={newNeighborhood} onChange={(e) => setNewNeighborhood(e.target.value)} />
                <Input placeholder="Taxa (R$)" type="number" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
                <Input placeholder="Tempo (min)" type="number" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
              <DialogFooter><Button onClick={handleAddZone}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pagamento</CardTitle>
              <CardDescription>Escolha quais formas de pagamento sua loja aceita.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="pay-cash">Dinheiro</Label>
                <Switch id="pay-cash" checked={paymentMethods.cash} onCheckedChange={(checked) => handlePaymentMethodChange('cash', checked)} />
              </div>
              {paymentMethods.cash && (
                <div className="flex items-center space-x-2 pl-4">
                  <Checkbox id="ask-change" checked={paymentMethods.cashAskForChange} onCheckedChange={handleCashAskForChange} />
                  <Label htmlFor="ask-change" className="text-sm font-normal">Perguntar se precisa de troco ao cliente</Label>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="pay-pix">PIX</Label>
                <Switch id="pay-pix" checked={paymentMethods.pix} onCheckedChange={(checked) => handlePaymentMethodChange('pix', checked)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="pay-credit">Cartão de Crédito</Label>
                <Switch id="pay-credit" checked={paymentMethods.credit} onCheckedChange={(checked) => handlePaymentMethodChange('credit', checked)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="pay-debit">Cartão de Débito</Label>
                <Switch id="pay-debit" checked={paymentMethods.debit} onCheckedChange={(checked) => handlePaymentMethodChange('debit', checked)} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSavePayments} disabled={isLoading}>Salvar Configurações de Pagamento</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Modelos de Mensagens (WhatsApp)</CardTitle>
              <CardDescription>Customize as mensagens automáticas enviadas aos clientes. Use <code className="bg-muted px-1">{`{cliente}`}</code> e <code className="bg-muted px-1">{`{pedido_id}`}</code> para dados dinâmicos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="msg-received">Pedido em Preparo</Label>
                <Textarea id="msg-received" value={whatsappTemplates.received} onChange={(e) => setWhatsappTemplates({...whatsappTemplates, received: e.target.value})} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-delivery">Saiu para Entrega</Label>
                <Textarea id="msg-delivery" value={whatsappTemplates.delivery} onChange={(e) => setWhatsappTemplates({...whatsappTemplates, delivery: e.target.value})} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-ready">Pronto para Retirada</Label>
                <Textarea id="msg-ready" value={whatsappTemplates.ready} onChange={(e) => setWhatsappTemplates({...whatsappTemplates, ready: e.target.value})} disabled={isLoading} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveMessages} disabled={isLoading}>Salvar Modelos</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
            <Card>
                <CardHeader>
                    <CardTitle>Plano e Assinatura</CardTitle>
                    <CardDescription>Detalhes do seu plano atual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Status Atual</p>
                        <p className="text-xl font-bold mt-1">
                            {companyData?.planId === 'trial' ? 'Período de Teste Gratuito' : planData?.name || 'Sem plano'}
                        </p>
                        <p className="text-sm mt-2">
                            Válido até: <span className="font-bold">{trialEndDate ? format(trialEndDate, 'dd/MM/yyyy') : 'N/A'}</span>
                        </p>
                    </div>
                    {companyData?.planId === 'trial' && (
                        <div className="border border-primary/20 p-4 rounded-lg bg-primary/5">
                            <p className="font-medium text-primary">Gostando da plataforma?</p>
                            <p className="text-sm text-muted-foreground mt-1">Seu teste expira em breve. Garanta que sua loja continue online assinando um plano.</p>
                            <Button className="mt-4" onClick={() => router.push('/dashboard/settings?tab=subscription')}>Ver Planos Disponíveis</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
