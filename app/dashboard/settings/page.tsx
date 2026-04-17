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
import { BellRing, Clock, DollarSign, PlusCircle, Trash2, Copy, Printer, Crown, AlertTriangle, CheckCircle, Send, MoreHorizontal } from 'lucide-react';
import { useFirestore, useDoc, setDocument, useMemoFirebase, useUser, useCollection, addDocument, deleteDocument, updateDocument, useAuth, deleteAuthUser } from '@/firebase';
import { doc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, isAfter } from 'date-fns';
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

type Waiter = {
  id: string;
  name: string;
  phone?: string;
  pin: string;
  isActive: boolean;
  companyId: string;
  createdAt: any;
};

type CompanySettingsData = {
    id?: string;
    name?: string;
    phone?: string;
    themeColors?: string;
    soundNotificationEnabled?: boolean;
    closedMessage?: string;
    averagePrepTime?: number;
    numberOfTables?: number;
    comandasEnabled?: boolean;
    ownerId?: string;
    planId?: string;
    isActive?: boolean;
    subscriptionEndDate?: any;
    trialUsed?: boolean;
    paymentMethods?: any;
    pixKey?: any;
    businessHours?: any;
    whatsappTemplates?: any;
};

type PlatformSettings = {
    pixKey?: string;
};

const SubscriptionView = ({ isExpired, trialEndDate, companyData }: { isExpired?: boolean, trialEndDate?: Date, companyData?: CompanySettingsData }) => {
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
    const { user } = useUser();
    const searchParams = useSearchParams();
    const router = useRouter();
    const paymentId = searchParams.get('payment_id');
    const [isVerifying, setIsVerifying] = useState(!!paymentId);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        if (paymentId && user && isVerifying && firestore) {
            const verifyPayment = async () => {
                toast({
                    title: "Verificando pagamento...",
                    description: "Aguarde enquanto confirmamos com o Mercado Pago.",
                });
                try {
                    const res = await fetch('/api/payments/verify', {
                        method: 'POST',
                        body: JSON.stringify({ payment_id: paymentId, companyId: user.uid })
                    });
                    const data = await res.json();
                    
                    if (data.approved) {
                        toast({
                            title: "🎉 Assinatura Aprovada!",
                            description: `Plano ${data.planName || ''} ativado por ${data.daysAdded || 30} dias com sucesso!`,
                            duration: 8000
                        });
                        router.replace('/dashboard/settings');
                    } else if (data.status === 'pending') {
                         toast({
                            variant: 'default',
                            title: "Pagamento Pendente",
                            description: "Seu pagamento via PIX ou Boleto ainda está pendente de aprovação.",
                        });
                        router.replace('/dashboard/settings');
                    } else {
                        toast({
                            variant: 'destructive',
                            title: "Pagamento não aprovado",
                            description: `Status do Mercado Pago: ${data.status || 'Desconhecido'}`
                        });
                        router.replace('/dashboard/settings');
                    }
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Erro de sistema', description: 'Ocorreu um erro ao verificar sua transação.' });
                }
                setIsVerifying(false);
            };
            verifyPayment();
        }
    }, [paymentId, user, isVerifying, firestore, router, toast]);

    const handleCheckout = async () => {
        if (!selectedPlan || !user) return;
        setIsCheckingOut(true);
        try {
            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: selectedPlan.id, companyId: user.uid })
            });
            const data = await res.json();
            if (data.init_point) {
                window.location.href = data.init_point;
            } else {
                toast({ variant: 'destructive', title: 'Erro ao gerar pagamento', description: data.error || 'Verifique as configurações do Mercado Pago no Admin.' });
                setIsCheckingOut(false);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Erro de conexão' });
            setIsCheckingOut(false);
        }
    };
    
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

    const currentPlan = plans?.find(p => p.id === companyData?.planId);
    const isPaidPlan = currentPlan && currentPlan.duration !== 'trial';

    if (!selectedPlan) {
        return (
            <div className="space-y-6 p-4">
                 <div className="text-center max-w-2xl mx-auto space-y-4">
                    {isExpired ? (
                        <Alert variant="destructive" className="bg-destructive/10">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertTitle>{isPaidPlan ? "Sua mensalidade está vencida!" : "Seu período de acesso expirou!"}</AlertTitle>
                            <AlertDescription>
                                {isPaidPlan 
                                    ? "Regularize seu pagamento para continuar usando o sistema. Seus dados estão salvos e seguros."
                                    : "Seu período de teste acabou. Para continuar vendendo e acessando seu painel, selecione um plano abaixo."}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="bg-primary/10 p-4 rounded-lg">
                            <h2 className="text-2xl font-bold text-primary">Você está no Período de Teste!</h2>
                            <p className="text-muted-foreground mt-1">Seu acesso gratuito vai até: <strong className="text-foreground">{trialEndDate ? format(trialEndDate, 'dd/MM/yyyy') : '--/--'}</strong></p>
                        </div>
                    )}

                    {isExpired && isPaidPlan && currentPlan && (
                        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-blue-900 leading-tight">Renovar Plano Atual</h3>
                                <p className="text-blue-700 text-sm">Pague agora para liberar seu acesso imediatamente no plano <strong>{currentPlan.name}</strong>.</p>
                            </div>
                            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 px-8 rounded-full shadow-lg hover:shadow-xl transition-all gap-2" onClick={() => handleSelectPlan(currentPlan)}>
                                <DollarSign className="h-5 w-5" /> Pagar Mensalidade (R$ {currentPlan.price.toFixed(2)})
                            </Button>
                        </div>
                    )}

                    <h2 className="text-3xl font-bold tracking-tight">
                        {isExpired && isPaidPlan ? "Ou escolha um novo plano" : "Escolha seu Plano"}
                    </h2>
                    <p className="text-muted-foreground">Selecione o plano que melhor se adapta ao seu negócio para ativar sua loja permanentemente.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans?.filter(plan => {
                        // Não mostrar planos de teste se já usou ou se o plano atual é pago
                        if (plan.duration === 'trial') {
                            return !companyData?.trialUsed && companyData?.planId === 'trial';
                        }
                        return true;
                    }).map((plan) => (
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
                    <CardTitle>Pagamento Automático</CardTitle>
                    <CardDescription>Plano selecionado: <span className="font-bold text-primary">{selectedPlan.name}</span></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center border-2 border-primary/20 p-6 rounded-xl bg-primary/5">
                        <span className="text-lg font-medium">Valor da Assinatura:</span>
                        <span className="text-3xl font-bold text-primary">R${selectedPlan.price.toFixed(2)}</span>
                    </div>
                     <Alert className="bg-primary/5 border-primary/20">
                        <Send className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-bold">Processamento Automático</AlertTitle>
                        <AlertDescription className="text-muted-foreground">
                            Você será redirecionado para o Checkout seguro do <strong>Mercado Pago</strong>. Retorne à esta página após o pagamento (PIX ou Cartão) e seu acesso será liberado instantaneamente na mesma hora.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full text-lg h-12 gap-2" size="lg" onClick={handleCheckout} disabled={isCheckingOut || isVerifying}>
                        {isCheckingOut || isVerifying ? 'Processando...' : 'Pagar Agora'}
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={() => setSelectedPlan(null)} disabled={isCheckingOut || isVerifying}>Cancelar e voltar</Button>
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

  const [isWaiterDialogOpen, setIsWaiterDialogOpen] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [waiterName, setWaiterName] = useState('');
  const [waiterPhone, setWaiterPhone] = useState('');
  const [waiterPin, setWaiterPin] = useState('');

  const companyRef = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return doc(firestore, 'companies', user.uid)
  }, [firestore, user]);
  
  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanySettingsData>(companyRef);

  const deliveryZonesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies', user.uid, 'deliveryZones');
  }, [firestore, user]);

  const { data: deliveryZones, isLoading: isLoadingZones } = useCollection<DeliveryZone>(deliveryZonesRef);

  const waitersRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies', user.uid, 'waiters');
  }, [firestore, user]);

  const { data: waiters, isLoading: isLoadingWaiters } = useCollection<Waiter>(waitersRef);
  
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
  const [closedMessage, setClosedMessage] = useState('');
  const [averagePrepTime, setAveragePrepTime] = useState(30);
  const [numberOfTables, setNumberOfTables] = useState(0);
  const [menuLink, setMenuLink] = useState('');
  const [waiterLink, setWaiterLink] = useState('');
  const [comandasEnabled, setComandasEnabled] = useState(true);
  const [pixKey, setPixKey] = useState('');
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
      setClosedMessage(companyData.closedMessage || '');
      setAveragePrepTime(companyData.averagePrepTime || 30);
      setNumberOfTables(companyData.numberOfTables || 0);
      setComandasEnabled(companyData.comandasEnabled ?? true);
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
      if (companyData.pixKey) {
        setPixKey(companyData.pixKey);
      }
       if (companyData.businessHours) {
        try {
          const hours = JSON.parse(companyData.businessHours);
          setBusinessHours(hours);
        } catch (e) {
          console.error("Error parsing business hours", e);
        }
      }
      if (companyData.whatsappTemplates) {
          try {
              const templates = JSON.parse(companyData.whatsappTemplates);
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
      setWaiterLink(`${window.location.origin}/waiter/${user.uid}/dashboard`);
    }
  }, [user?.uid]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Link Copiado!',
      description: 'O link foi copiado para a área de transferência.',
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
        closedMessage: closedMessage,
        averagePrepTime: averagePrepTime,
        numberOfTables: numberOfTables,
        comandasEnabled: comandasEnabled,
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
    setDocument(companyRef, { paymentMethods, pixKey, ownerId: user.uid }, { merge: true }).then(() => {
        toast({
            title: 'Pagamentos Salvos!',
            description: 'Suas formas de pagamento e chave PIX foram atualizadas.',
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

  const handleOpenWaiterDialog = (waiter: Waiter | null = null) => {
    setEditingWaiter(waiter);
    if (waiter) {
      setWaiterName(waiter.name);
      setWaiterPhone(waiter.phone || '');
      setWaiterPin(waiter.pin);
    } else {
      setWaiterName('');
      setWaiterPhone('');
      setWaiterPin('');
    }
    setIsWaiterDialogOpen(true);
  };

  const handleSaveWaiter = () => {
    if (!waitersRef || !user) return;
    
    if (!waiterName.trim() || !waiterPin.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Nome e PIN são obrigatórios.',
      });
      return;
    }

    if (waiterPin.length < 4) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'O PIN deve ter pelo menos 4 dígitos.',
      });
      return;
    }

    const waiterData = {
      name: waiterName.trim(),
      phone: waiterPhone.trim() || undefined,
      pin: waiterPin.trim(),
      isActive: true,
      companyId: user.uid,
      createdAt: serverTimestamp(),
    };

    if (editingWaiter) {
      const waiterDocRef = doc(firestore!, 'companies', user.uid, 'waiters', editingWaiter.id);
      updateDocument(waiterDocRef, waiterData).then(() => {
        toast({
          title: 'Garçom Atualizado!',
          description: `${waiterName} foi atualizado com sucesso.`,
        });
        setIsWaiterDialogOpen(false);
        setEditingWaiter(null);
      });
    } else {
      addDocument(waitersRef, waiterData).then(() => {
        toast({
          title: 'Garçom Adicionado!',
          description: `${waiterName} foi cadastrado com sucesso.`,
        });
        setIsWaiterDialogOpen(false);
      });
    }
  };

  const handleDeleteWaiter = (waiterId: string, waiterName: string) => {
    if (!firestore || !user) return;
    const waiterDocRef = doc(firestore, 'companies', user.uid, 'waiters', waiterId);
    deleteDocument(waiterDocRef).then(() => {
      toast({
        title: 'Garçom Excluído',
        description: `${waiterName} foi removido da lista.`,
        variant: 'destructive'
      });
    });
  };

  const handleToggleWaiterStatus = (waiter: Waiter) => {
    if (!firestore || !user) return;
    const waiterDocRef = doc(firestore, 'companies', user.uid, 'waiters', waiter.id);
    updateDocument(waiterDocRef, { isActive: !waiter.isActive });
  };

  const isLoading = isUserLoadingAuth || isLoadingCompany || isLoadingZones || isLoadingPlan || isLoadingWaiters;

  const weekDays: { key: keyof BusinessHours; label: string }[] = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  if (isLoading) return <p>Carregando configurações...</p>;
  
  const trialEndDate = companyData?.subscriptionEndDate?.toDate();
  const isTrialExpired = trialEndDate && isAfter(new Date(), trialEndDate);
  const isInactive = companyData?.isActive === false;

  if (isInactive || isTrialExpired) {
    return <SubscriptionView isExpired={isTrialExpired} trialEndDate={trialEndDate} companyData={companyData || undefined} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie sua loja e conta.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
          <TabsTrigger value="profile">Empresa</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="waiters">Garçons</TabsTrigger>
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
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isLoading} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="average-prep-time">Tempo médio de preparo (minutos)</Label>
                <Input id="average-prep-time" type="number" value={averagePrepTime} onChange={(e) => setAveragePrepTime(Number(e.target.value))} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number-of-tables">Número de Mesas do Restaurante</Label>
                <Input id="number-of-tables" type="number" value={numberOfTables} onChange={(e) => setNumberOfTables(Number(e.target.value))} min={0} placeholder="Ex: 20" disabled={isLoading} />
                <p className="text-xs text-muted-foreground">Útil para o sistema de garçom via celular.</p>
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5 border-primary/20">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold" htmlFor="comandas-enabled">Ativar Sistema de Comandas (Mesas/Garçom)</Label>
                  <p className="text-sm text-muted-foreground">Habilita a gestão de mesas e pedidos via garçom no painel e no celular.</p>
                </div>
                <Switch id="comandas-enabled" checked={comandasEnabled} onCheckedChange={setComandasEnabled} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closed-message">Mensagem de loja fechada</Label>
                <Textarea id="closed-message" value={closedMessage} onChange={(e) => setClosedMessage(e.target.value)} placeholder="Estamos fechados no momento..." disabled={isLoading} />
              </div>
              <Separator />
               <div className="space-y-2">
                <Label htmlFor="menu-link">Link do Cardápio (Clientes)</Label>
                <div className="flex items-center gap-2">
                  <Input id="menu-link" value={menuLink} readOnly disabled={isLoading} />
                  <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(menuLink)} disabled={isLoading}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {comandasEnabled && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="waiter-link">Link das Comandas (Garçons)</Label>
                    <div className="flex items-center gap-2">
                      <Input id="waiter-link" value={waiterLink} readOnly disabled={isLoading} />
                      <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(waiterLink)} disabled={isLoading}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Acesso rápido para garçons abrirem mesas e lançarem pedidos.</p>
                  </div>
                </>
              )}
              <Separator />
               <div className="space-y-4">
                 <Label className="text-base">Notificações</Label>
                 <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="font-medium" htmlFor="sound-notification">Ativar campainha para novos pedidos</Label>
                      <p className="text-xs text-muted-foreground">Um som de campainha tocará para cada novo pedido.</p>
                    </div>
                    <Switch id="sound-notification" checked={soundNotificationEnabled} onCheckedChange={setSoundNotificationEnabled} disabled={isLoading} />
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
              {weekDays.map(({ key, label }, index) => (
                <div key={`${key}-${index}`} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <Switch checked={businessHours[key]?.isOpen} onCheckedChange={(checked) => handleHoursChange(key, 'isOpen', checked)} id={`switch-${key}-${index}`} disabled={isLoading} />
                    <Label htmlFor={`switch-${key}-${index}`} className="w-24">{label}</Label>
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
                    <Button size="sm" className="gap-1" disabled={isLoading}><PlusCircle className="h-4 w-4" /> Adicionar Bairro</Button>
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
              {paymentMethods.pix && (
                <div className="flex flex-col space-y-2 pl-4">
                  <Label htmlFor="pix-key" className="text-sm font-normal">Chave PIX (Opcional)</Label>
                  <Input id="pix-key" placeholder="Ex: email@dominio.com, CPF, Telefone..." value={pixKey} onChange={(e) => setPixKey(e.target.value)} disabled={isLoading} />
                </div>
              )}
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

        <TabsContent value="waiters">
          <Dialog open={isWaiterDialogOpen} onOpenChange={(isOpen) => {
            setIsWaiterDialogOpen(isOpen);
            if (!isOpen) setEditingWaiter(null);
          }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Garçons</CardTitle>
                    <CardDescription>Gerencie os garçons que terão acesso às comandas.</CardDescription>
                  </div>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1" disabled={isLoading} onClick={() => handleOpenWaiterDialog()}>
                      <PlusCircle className="h-4 w-4" /> Adicionar Garçom
                    </Button>
                  </DialogTrigger>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>PIN</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && waiters?.map((waiter) => (
                      <TableRow key={waiter.id}>
                        <TableCell className="font-medium">{waiter.name}</TableCell>
                        <TableCell>{waiter.phone || '-'}</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">{waiter.pin}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={waiter.isActive ? 'default' : 'secondary'}>
                            {waiter.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Switch
                              checked={waiter.isActive}
                              onCheckedChange={() => handleToggleWaiterStatus(waiter)}
                              size="sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenWaiterDialog(waiter)}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Garçom</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir {waiter.name}? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteWaiter(waiter.id, waiter.name)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && (!waiters || waiters.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum garçom cadastrado ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingWaiter ? 'Editar Garçom' : 'Adicionar Garçom'}</DialogTitle>
                <DialogDescription>
                  {editingWaiter ? 'Atualize as informações do garçom.' : 'Cadastre um novo garçom para acessar as comandas.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="waiter-name">Nome Completo</Label>
                  <Input
                    id="waiter-name"
                    placeholder="Ex: João Silva"
                    value={waiterName}
                    onChange={(e) => setWaiterName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waiter-phone">Telefone (Opcional)</Label>
                  <Input
                    id="waiter-phone"
                    placeholder="Ex: (11) 99999-9999"
                    value={waiterPhone}
                    onChange={(e) => setWaiterPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="waiter-pin">PIN de Acesso</Label>
                  <Input
                    id="waiter-pin"
                    type="password"
                    placeholder="Ex: 1234"
                    value={waiterPin}
                    onChange={(e) => setWaiterPin(e.target.value)}
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Código de 4-6 dígitos para o garçom acessar as comandas.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSaveWaiter} disabled={isLoading}>
                  {editingWaiter ? 'Atualizar' : 'Cadastrar'} Garçom
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                    <CardTitle>Sua Assinatura</CardTitle>
                    <CardDescription>Gerencie seus pagamentos e plano atual.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-primary/5 border-primary/20">
                         <div>
                            <p className="text-sm text-muted-foreground">Plano Atual</p>
                            <p className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                {planData?.name || (companyData?.planId === 'trial' ? 'Período de Teste' : 'Bronze')}
                            </p>
                         </div>
                         <div className="text-right">
                             <p className="text-sm text-muted-foreground">Expira em</p>
                             <p className="font-medium">{trialEndDate ? format(trialEndDate, 'dd/MM/yyyy') : '--/--/----'}</p>
                         </div>
                    </div>
                    
                    <Alert className="border-primary/20 bg-primary/5">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-bold">Assinatura Ativa</AlertTitle>
                        <AlertDescription className="text-muted-foreground">
                            Seu acesso está liberado. Quando sua assinatura estiver próxima do fim, novas opções de renovação aparecerão aqui.
                        </AlertDescription>
                    </Alert>
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">Fale com o suporte para mudanças de plano.</p>
                </CardFooter>
             </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>Ações irreversíveis para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Excluir minha Loja e Dados</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente sua loja, 
                  todos os produtos, pedidos e removerá seu acesso ao sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                    if (!user || !auth) return;
                    try {
                        const companyDocRef = doc(firestore!, 'companies', user.uid);
                        const companyUserDocRef = doc(firestore!, 'users', user.uid);
                        
                        await Promise.all([
                            deleteDocument(companyDocRef),
                            deleteDocument(companyUserDocRef)
                        ]);
                        
                        await deleteAuthUser(user);
                        router.push('/signup');
                        toast({ title: "Conta excluída", description: "Sua loja foi removida com sucesso." });
                    } catch (e) {
                         toast({ variant: 'destructive', title: "Erro ao excluir", description: "Tente novamente ou contate o suporte." });
                    }
                }}>
                  Sim, excluir tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
