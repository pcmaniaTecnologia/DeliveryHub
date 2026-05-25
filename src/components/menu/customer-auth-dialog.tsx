'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, LogOut, Loader2, Package, MapPin, ReceiptText, ChevronDown, ChevronUp, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export function CustomerAuthDialog({ companyId }: { companyId?: string }) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form states for login/register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  
  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [hasPopulated, setHasPopulated] = useState(false);

  // Load user profile if logged in
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user || user.isAnonymous) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userProfile } = useDoc<any>(userProfileRef);

  useEffect(() => {
    if (isOpen) {
      if (userProfile && !hasPopulated) {
        setName(userProfile.name || '');
        setPhone(userProfile.phone || '');
        setStreet(userProfile.addressStreet || '');
        setNumber(userProfile.addressNumber || '');
        setNeighborhood(userProfile.addressNeighborhood || '');
        setComplement(userProfile.addressComplement || '');
        setHasPopulated(true);
      }
    } else {
      setHasPopulated(false);
    }
  }, [userProfile, isOpen, hasPopulated]);

  useEffect(() => {
    let unsubscribe: () => void;
    
    if (isOpen && user && !user.isAnonymous && companyId) {
      setIsLoadingOrders(true);
      const q = query(collection(firestore, 'companies', companyId, 'orders'), where('customerId', '==', user.uid));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Separar ativos
        const ativos = ordersList.filter(o => {
            const s = String(o.status || '').toLowerCase();
            return s !== 'concluído' && s !== 'cancelado';
        });
        
        // Ordenar todos para o histórico
        ordersList.sort((a: any, b: any) => {
          const dateA = a.orderDate?.toMillis ? a.orderDate.toMillis() : 0;
          const dateB = b.orderDate?.toMillis ? b.orderDate.toMillis() : 0;
          return dateB - dateA; // Descending
        });
        
        setActiveOrders(ativos);
        setOrders(ordersList);
        setIsLoadingOrders(false);
      }, (error) => {
        console.error("Erro no realtime orders:", error);
        setIsLoadingOrders(false);
      });
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, user, companyId]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    if (value.length > 10) value = `${value.slice(0, 10)}-${value.slice(10)}`;
    setPhone(value);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    // Profile states are resetted by useEffect when user opens/closes
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Login realizado com sucesso!' });
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao fazer login', description: 'E-mail ou senha incorretos.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!auth) return;
    if (!email) {
      toast({ variant: 'destructive', title: 'Preencha o e-mail', description: 'Digite seu e-mail no campo acima para receber o link de recuperação.' });
      return;
    }
    
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: 'E-mail de recuperação enviado!', description: 'Verifique sua caixa de entrada e pasta de spam.' });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao recuperar', description: 'Não foi possível enviar o e-mail. Verifique se o endereço está correto.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        name,
        phone,
        addressStreet: street,
        addressNumber: number,
        addressNeighborhood: neighborhood,
        addressComplement: complement,
        email,
        createdAt: new Date()
      });
      toast({ title: 'Cadastro realizado com sucesso!' });
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao cadastrar', description: error.message || 'Verifique os dados e tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || user.isAnonymous) return;
    setIsLoading(true);
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        name,
        phone,
        addressStreet: street,
        addressNumber: number,
        addressNeighborhood: neighborhood,
        addressComplement: complement,
        updatedAt: new Date()
      }, { merge: true });
      toast({ title: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro ao atualizar perfil' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setIsOpen(false);
      setName('');
      setPhone('');
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setComplement('');
      toast({ title: 'Você saiu da conta.' });
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'novo': return <Badge variant="default" className="bg-blue-500">Novo</Badge>;
      case 'preparando': return <Badge variant="secondary" className="bg-yellow-500 text-white">Preparando</Badge>;
      case 'pronto': return <Badge variant="secondary" className="bg-green-500 text-white">Pronto</Badge>;
      case 'saiu para entrega': return <Badge variant="secondary" className="bg-purple-500 text-white">Em Rota</Badge>;
      case 'concluído': return <Badge variant="secondary" className="bg-emerald-600 text-white">Concluído</Badge>;
      case 'cancelado': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit' });
  };

  const OrderProgress = ({ order }: { order: any }) => {
    const statusStr = String(order.status || '').toLowerCase();
    
    let currentStep = 0;
    if (statusStr === 'novo') currentStep = 1;
    else if (statusStr === 'preparando' || statusStr === 'em preparo') currentStep = 2;
    else if (statusStr === 'saiu para entrega' || statusStr === 'em rota' || statusStr === 'pronto') currentStep = 3;
    else if (statusStr === 'concluído' || statusStr === 'entregue') currentStep = 4;
    else currentStep = 0; // fallback para cancelado ou outros

    const steps = [
      { num: 1, label: 'Enviado' },
      { num: 2, label: 'Preparando' },
      { num: 3, label: order.deliveryType === 'Delivery' ? 'Em Rota' : 'Pronto' },
      { num: 4, label: 'Entregue' }
    ];

    return (
      <div className="py-6 px-4">
        <div className="relative flex justify-between items-center w-full">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-muted rounded-full"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary rounded-full transition-all duration-700 ease-in-out"
            style={{ width: `${((Math.max(currentStep - 1, 0)) / 3) * 100}%` }}
          ></div>
          
          {steps.map(step => {
            const isCompleted = currentStep > step.num;
            const isCurrent = currentStep === step.num;
            return (
              <div key={step.num} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-4 transition-colors duration-500 ${isCompleted ? 'bg-primary border-primary text-primary-foreground' : isCurrent ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 'bg-background border-muted text-muted-foreground'}`}>
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                  
                  {isCurrent && (
                    <span className="absolute -inset-[6px] rounded-full border-[3px] border-primary/20 border-t-primary animate-spin"></span>
                  )}
                </div>
                <span className={`absolute -bottom-6 text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors duration-500 ${isCurrent ? 'text-primary font-bold animate-pulse' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (user && !user.isAnonymous) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 rounded-full border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
            <User className="h-4 w-4" />
            Minha Conta
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex justify-between items-center pr-6">
                <div>
                    <DialogTitle className="text-xl">Painel do Cliente</DialogTitle>
                    <DialogDescription>
                    Gerencie seus dados e acompanhe seus pedidos.
                    </DialogDescription>
                </div>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="dados" className="flex-grow flex flex-col min-h-0">
            <div className="px-6 pt-2 shrink-0">
                <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados" className="gap-2 text-xs sm:text-sm"><User className="h-3.5 w-3.5 hidden sm:block" /> Perfil</TabsTrigger>
                <TabsTrigger value="acompanhar" className="gap-2 text-xs sm:text-sm relative">
                  <Clock className="h-3.5 w-3.5 hidden sm:block" /> Acompanhar
                  {activeOrders.length > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>}
                </TabsTrigger>
                <TabsTrigger value="pedidos" className="gap-2 text-xs sm:text-sm"><ReceiptText className="h-3.5 w-3.5 hidden sm:block" /> Histórico</TabsTrigger>
                </TabsList>
            </div>
            
            <ScrollArea className="flex-grow">
                <div className="p-6 pt-4">
                    <TabsContent value="dados" className="mt-0 space-y-4">
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nome Completo</Label>
                            <Input id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">WhatsApp</Label>
                            <Input id="edit-phone" required value={phone} onChange={handlePhoneChange} placeholder="(99) 99999-9999" maxLength={15} />
                        </div>
                        
                        <div className="text-sm font-semibold flex items-center gap-2 mt-6 pt-4 border-t">
                            <MapPin className="h-4 w-4 text-primary" /> Endereço Padrão de Entrega
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-street">Rua</Label>
                            <Input id="edit-street" value={street} onChange={(e) => setStreet(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                            <Label htmlFor="edit-number">Número</Label>
                            <Input id="edit-number" value={number} onChange={(e) => setNumber(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                            <Label htmlFor="edit-neighborhood">Bairro</Label>
                            <Input id="edit-neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-complement">Complemento</Label>
                            <Input id="edit-complement" placeholder="Ex: Apto 12, Bloco B (Opcional)" value={complement} onChange={(e) => setComplement(e.target.value)} />
                        </div>

                        <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Salvar Alterações
                        </Button>
                        </form>
                    </TabsContent>

                    <TabsContent value="acompanhar" className="mt-0">
                        {isLoadingOrders ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                            </div>
                        ) : activeOrders.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground flex flex-col items-center bg-muted/10 rounded-xl border border-dashed">
                                <Clock className="h-12 w-12 mb-3 text-muted-foreground/30" />
                                <p>Nenhum pedido em andamento no momento.</p>
                                <p className="text-xs mt-2">Vá na aba Histórico para ver pedidos antigos.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {activeOrders.map(order => (
                                    <div key={order.id} className="border rounded-xl bg-card overflow-hidden shadow-sm">
                                        <div className="p-4 flex items-center justify-between border-b bg-muted/10">
                                            <div>
                                                <h3 className="font-bold">Pedido #{order.id.substring(0,6).toUpperCase()}</h3>
                                                <div className="text-xs text-muted-foreground mt-1">Realizado às {formatTime(order.orderDate)}</div>
                                            </div>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <div className="p-2 pb-6">
                                            <OrderProgress order={order} />
                                        </div>
                                        {order.status.toLowerCase() === 'saiu para entrega' && order.deliveryType === 'Delivery' && (
                                            <div className="px-4 py-3 bg-primary/10 border-t border-primary/20 text-sm flex items-start gap-3">
                                                <div className="mt-0.5"><MapPin className="h-4 w-4 text-primary" /></div>
                                                <div>
                                                    <p className="font-bold text-primary mb-1">Seu pedido está a caminho!</p>
                                                    <p className="text-xs text-foreground/80">O entregador já saiu da loja. Fique atento e deixe alguém pronto para receber no endereço: <strong>{order.deliveryAddress}</strong></p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="px-4 py-3 bg-muted/20 border-t text-sm flex justify-between">
                                            <span className="text-muted-foreground">Total a pagar ({order.paymentMethod}):</span>
                                            <span className="font-bold">R$ {Number(order.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="pedidos" className="mt-0">
                        {isLoadingOrders ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                                <Package className="h-12 w-12 mb-3 text-muted-foreground/30" />
                                <p>Nenhum pedido encontrado nesta loja.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map(order => (
                                    <div key={order.id} className="border rounded-xl bg-card overflow-hidden transition-all shadow-sm">
                                        <div 
                                            className="p-4 cursor-pointer flex items-center justify-between hover:bg-muted/30"
                                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">Pedido #{order.id.substring(0,6).toUpperCase()}</span>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatTime(order.orderDate)} • {order.deliveryType}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-primary">R$ {Number(order.totalAmount || 0).toFixed(2)}</span>
                                                {expandedOrderId === order.id ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                            </div>
                                        </div>
                                        
                                        {expandedOrderId === order.id && (
                                            <div className="px-4 pb-4 pt-2 border-t bg-muted/10">
                                                <div className="space-y-2 mb-3">
                                                    {order.orderItems?.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0 border-border/50">
                                                            <div className="flex gap-2">
                                                                <span className="font-medium text-muted-foreground">{item.isSoldByWeight ? `${Number(item.quantity).toFixed(3)}kg` : `${item.quantity}x`}</span>
                                                                <div>
                                                                    <span>{item.productName}</span>
                                                                    {item.selectedVariants?.map((v:any, i:number) => (
                                                                        <div key={i} className="text-xs text-muted-foreground">+ {v.itemName}</div>
                                                                    ))}
                                                                    {item.notes && <div className="text-xs text-orange-500/80 italic">Obs: {item.notes}</div>}
                                                                </div>
                                                            </div>
                                                            <span className="text-muted-foreground">R$ {Number(item.finalPrice || 0).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="text-xs space-y-1 bg-background p-3 rounded-lg border">
                                                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {Number(order.totalAmount - (order.deliveryFee || 0)).toFixed(2)}</span></div>
                                                    <div className="flex justify-between"><span className="text-muted-foreground">Taxa de Entrega</span><span>R$ {Number(order.deliveryFee || 0).toFixed(2)}</span></div>
                                                    <Separator className="my-1" />
                                                    <div className="flex justify-between font-bold"><span className="text-muted-foreground">Pagamento</span><span>{order.paymentMethod}</span></div>
                                                    {order.deliveryType === 'Delivery' && (
                                                        <div className="mt-2 pt-2 border-t text-muted-foreground">
                                                            <strong>Endereço:</strong> {order.deliveryAddress}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </ScrollArea>
          </Tabs>

          <div className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Sair da Conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Not logged in UI (Login/Register)
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <User className="h-4 w-4" />
          Entrar / Cadastrar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Acesso do Cliente</DialogTitle>
          <DialogDescription>
            Acesse sua conta ou cadastre-se para salvar seus dados e pedir mais rápido.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Cadastrar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email-login">E-mail</Label>
                <Input id="email-login" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password-login">Senha</Label>
                  <Button 
                    type="button" 
                    variant="link" 
                    className="p-0 h-auto text-xs font-normal" 
                    onClick={handleForgotPassword}
                  >
                    Esqueceu a senha?
                  </Button>
                </div>
                <Input id="password-login" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" required value={phone} onChange={handlePhoneChange} placeholder="(99) 99999-9999" maxLength={15} />
              </div>
              
              <div className="text-sm font-semibold mt-4">Endereço Padrão (Opcional)</div>
              <div className="space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input id="complement" placeholder="Ex: Apto 12, Bloco B (Opcional)" value={complement} onChange={(e) => setComplement(e.target.value)} />
              </div>

              <div className="text-sm font-semibold mt-4">Acesso</div>
              <div className="space-y-2">
                <Label htmlFor="email-reg">E-mail *</Label>
                <Input id="email-reg" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-reg">Senha *</Label>
                <Input id="password-reg" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
              </div>
              
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Conta'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
