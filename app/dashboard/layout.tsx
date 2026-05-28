'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Package2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, type Timestamp } from 'firebase/firestore';
import { useImpersonation } from '@/context/impersonation-context';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { DashboardNav } from '@/components/dashboard-nav';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useUser } from '@/firebase';
import { hexToHsl } from '@/lib/utils';
import type { Order } from './orders/page';
import { NotificationProvider, useNotifications } from '@/context/notification-context';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const notificationSoundUrl = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

type CompanyData = {
    themeColors?: string;
    soundNotificationEnabled?: boolean;
    autoPrintEnabled?: boolean;
    isActive?: boolean;
    planId?: string;
    subscriptionEndDate?: Timestamp;
    name?: string;
    comandasEnabled?: boolean;
};

const SoundPlayer = () => {
    const { playTrigger } = useNotifications();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioBlocked, setIsAudioBlocked] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const playSound = async () => {
            if (playTrigger > 0 && audioRef.current) {
                try {
                    audioRef.current.currentTime = 0;
                    await audioRef.current.play();
                    setIsAudioBlocked(false);
                } catch (error) {
                    console.warn("Audio playback blocked by browser.");
                    setIsAudioBlocked(true);
                }
            }
        };
        playSound();
    }, [playTrigger]);

    useEffect(() => {
        const unlockAudio = () => {
            if (isAudioBlocked && audioRef.current) {
                audioRef.current.play().then(() => {
                    audioRef.current?.pause();
                    setIsAudioBlocked(false);
                    toast({
                        title: "Sons Ativados!",
                        description: "A campainha de novos pedidos está pronta.",
                    });
                }).catch(() => {});
            }
        };

        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, [isAudioBlocked, toast]);

    return (
        <>
            <audio ref={audioRef} src={notificationSoundUrl} preload="auto" />
            {isAudioBlocked && (
                <div className="fixed bottom-4 left-4 z-50 max-w-sm">
                    <Alert variant="destructive" className="bg-destructive text-destructive-foreground animate-pulse cursor-pointer shadow-lg" onClick={() => setIsAudioBlocked(false)}>
                        <VolumeX className="h-4 w-4" />
                        <AlertTitle>Som Requer Ativação</AlertTitle>
                        <AlertDescription>
                            Clique aqui para ativar os alertas sonoros de novos pedidos.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </>
    );
};


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const { isImpersonating, impersonatedCompanyId, impersonatedCompanyName, stopImpersonation } = useImpersonation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // When admin impersonates a company, use their ID instead of the logged-in admin's UID
  const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    return doc(firestore, 'companies', effectiveCompanyId);
  }, [firestore, effectiveCompanyId]);

  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanyData>(companyRef);

  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user?.uid]);

  const { data: adminData, isLoading: isLoadingAdmin } = useDoc(adminRef);

  const allOrdersRef = useMemoFirebase(() => {
    if (!firestore || !effectiveCompanyId) return null;
    return collection(firestore, `companies/${effectiveCompanyId}/orders`);
  }, [firestore, effectiveCompanyId]);

  const { data: allOrders, isLoading: isLoadingAllOrders } = useCollection<Order>(allOrdersRef);
  
  const newOrdersCount = useMemo(() => {
    if (!allOrders) return 0;
    return allOrders.filter(order => order.status === 'Novo' || order.status === 'Aguardando pagamento').length;
  }, [allOrders]);
  
  const subscriptionReminder = useMemo(() => {
    if (isImpersonating || !companyData?.subscriptionEndDate) return null;
    
    const now = new Date();
    const endDate = companyData.subscriptionEndDate.toDate();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    console.log('[DEBUG] Vencimento:', endDate, 'Dias restantes:', diffDays);

    // Exibe apenas quando faltarem 3 dias ou menos
    if (diffDays > 0 && diffDays <= 3) {
      return {
        days: diffDays,
        date: endDate
      };
    }
    return null;
  }, [companyData, isImpersonating]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

   useEffect(() => {
    // Skip subscription check when admin is impersonating
    if (isImpersonating) return;
    if (!isLoadingCompany && companyData) {
        const now = new Date();
        const endDate = companyData.subscriptionEndDate?.toDate();
        const isExpired = endDate && now > endDate;

        if (companyData.isActive === false || isExpired) {
            if (pathname !== '/dashboard/settings') {
                router.push('/dashboard/settings');
            }
        }
    }
  }, [companyData, isLoadingCompany, router, pathname, isImpersonating]);
  
  useEffect(() => {
    if (companyData?.themeColors) {
        try {
            // Suporta tanto string JSON quanto objeto direto do Firestore
            const parsed = typeof companyData.themeColors === 'string'
                ? JSON.parse(companyData.themeColors)
                : companyData.themeColors;
            const { primary, accent } = parsed || {};
            if (primary) {
                const primaryHsl = hexToHsl(primary);
                if (primaryHsl) {
                    document.documentElement.style.setProperty('--primary', `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
                    document.documentElement.style.setProperty('--ring', `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
                }
            }
            if (accent) {
                 const accentHsl = hexToHsl(accent);
                 if (accentHsl) {
                    document.documentElement.style.setProperty('--accent', `${accentHsl.h} ${accentHsl.s}% ${accentHsl.l}%`);
                 }
            }
        } catch (_) {
            // Silencioso: mantém cores padrão se o parse falhar
        }
    }
}, [companyData]);


  if (isUserLoading || isLoadingCompany || !user || isLoadingAllOrders || isLoadingAdmin) {
    return <LoadingScreen />;
  }

  return (
    <NotificationProvider companyData={companyData}>
      <SoundPlayer />
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-background lg:block">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-16 items-center border-b px-6">
              <Link href="/dashboard" className="flex items-center">
                <span className="text-xl font-black tracking-tighter text-primary">DeliveryHub</span>
              </Link>
            </div>
            <div className="flex-1 pt-2 overflow-y-auto">
              <DashboardNav newOrdersCount={newOrdersCount} isAdmin={!!adminData} comandasEnabled={companyData?.comandasEnabled ?? true} />
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Alternar menu de navegação</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                <div className="flex h-16 items-center border-b px-6">
                  <Link href="/dashboard" className="flex items-center">
                    <span className="text-xl font-black tracking-tighter text-primary">DeliveryHub</span>
                  </Link>
                </div>
                <div className="mt-5 flex-1 overflow-y-auto">
                  <DashboardNav newOrdersCount={newOrdersCount} isAdmin={!!adminData} comandasEnabled={companyData?.comandasEnabled ?? true} onNavItemClick={() => setIsMobileMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="w-full flex-1 flex flex-col items-center justify-center text-[10px] sm:text-xs">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="font-bold text-foreground tracking-tight">Suporte Técnico</span>
                <a href="https://wa.me/5533987507606" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline transition-colors font-medium">
                  (33) 9.8750-7606
                </a>
                <span className="hidden sm:inline">|</span>
                <a href="https://www.pcmania.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">www.pcmania.net</a>
              </div>
            </div>
            <UserNav isAdmin={!!adminData} />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-8 lg:p-8 bg-muted/20">

            {isImpersonating && (
              <div className="flex items-center justify-between bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium shadow">
                <span>👁️ Modo Admin: visualizando o painel de <strong>{impersonatedCompanyName}</strong></span>
                <Button size="sm" variant="outline" className="text-destructive border-destructive-foreground bg-destructive-foreground hover:bg-white" onClick={stopImpersonation}>
                  Sair da Empresa
                </Button>
              </div>
            )}

            {subscriptionReminder && pathname !== '/dashboard/settings' && (
               <Alert className="bg-yellow-50 border-yellow-200 text-yellow-900 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                    <div>
                      <AlertTitle className="font-bold">Sua assinatura expira em breve!</AlertTitle>
                      <AlertDescription>
                        Faltam apenas <strong>{subscriptionReminder.days} {subscriptionReminder.days === 1 ? 'dia' : 'dias'}</strong> para o vencimento (vence em {format(subscriptionReminder.date, 'dd/MM/yyyy')}).
                      </AlertDescription>
                    </div>
                    <Link href="/dashboard/settings">
                      <Button size="sm" variant="outline" className="bg-white border-yellow-400 text-yellow-700 hover:bg-yellow-100">
                        Renovar Agora
                      </Button>
                    </Link>
                  </div>
               </Alert>
            )}
            
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
