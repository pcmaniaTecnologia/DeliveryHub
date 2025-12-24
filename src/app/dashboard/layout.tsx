
'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Package2,
} from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { DashboardNav } from '@/components/dashboard-nav';
import { useUser } from '@/firebase';
import { hexToHsl } from '@/lib/utils';
import type { Order } from './orders/page';
import { generateOrderPrintHtml } from '@/lib/print-utils';

type CompanyData = {
    themeColors?: string;
    soundNotificationEnabled?: boolean;
    autoPrintEnabled?: boolean;
    isActive?: boolean;
    planId?: string;
    subscriptionEndDate?: any;
    name?: string;
};

// A valid, short beep sound in Base64 format.
const notificationSound = "data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAhAAAA9/8A/f8E/wMAAgAFAAMACQD0/wD9/w==";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [processedOrderIds, setProcessedOrderIds] = useState<Set<string>>(new Set());

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'companies', user.uid);
  }, [firestore, user?.uid]);

  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanyData>(companyRef);

  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user?.uid]);

  const { data: adminData, isLoading: isLoadingAdmin } = useDoc(adminRef);

  // This collection hook is just for the badge count.
  const allOrdersRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, `companies/${user.uid}/orders`);
  }, [firestore, user?.uid]);

  const { data: allOrders, isLoading: isLoadingAllOrders } = useCollection<Order>(allOrdersRef);
  
  const newOrdersCount = useMemo(() => {
    if (!allOrders) return 0;
    return allOrders.filter(order => order.status === 'Novo' || order.status === 'Aguardando pagamento').length;
  }, [allOrders]);

  // This effect sets up the first user interaction listener for audio.
  useEffect(() => {
    const handleFirstInteraction = () => {
        if (!hasInteracted) {
            setHasInteracted(true);
            if (!audioRef.current) {
                audioRef.current = new Audio(notificationSound);
            }
            audioRef.current.load();
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [hasInteracted]);

  // This effect listens for NEW orders in real-time.
  useEffect(() => {
    if (!firestore || !user?.uid || !companyData) return;

    // Only set up the listener if sound or printing is enabled.
    if (!companyData.soundNotificationEnabled && !companyData.autoPrintEnabled) {
      return;
    }

    const q = query(
        collection(firestore, `companies/${user.uid}/orders`), 
        where('status', 'in', ['Novo', 'Aguardando pagamento'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // We only care about newly added documents.
        if (change.type === 'added') {
          const order = { id: change.doc.id, ...change.doc.data() } as Order;
          
          // Check if we've already processed this order ID.
          if (!processedOrderIds.has(order.id)) {
            
            // 1. Play sound if enabled
            if (companyData.soundNotificationEnabled && audioRef.current && hasInteracted) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
            }

            // 2. Auto-print if enabled
            if (companyData.autoPrintEnabled && hasInteracted) {
              const printHtml = generateOrderPrintHtml(order, companyData);
              const printWindow = window.open('', '_blank', 'width=300,height=500');
              if (printWindow) {
                  printWindow.document.write(printHtml);
                  printWindow.document.close();
              }
            }

            // 3. Mark order as processed to avoid duplicates
            setProcessedOrderIds(prev => new Set(prev).add(order.id));
          }
        }
      });
    });

    return () => unsubscribe(); // Cleanup the listener on unmount.
  }, [firestore, user?.uid, companyData, hasInteracted, processedOrderIds]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

   useEffect(() => {
    if (!isLoadingCompany && companyData && companyData.isActive === false) {
        if (pathname !== '/dashboard/settings') {
            router.push('/dashboard/settings');
        }
    }
  }, [companyData, isLoadingCompany, router, pathname]);
  
  useEffect(() => {
    if (companyData?.themeColors) {
        try {
            const { primary, accent } = JSON.parse(companyData.themeColors);
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
        } catch (error) {
            console.error("Failed to parse or apply theme colors:", error);
        }
    }
}, [companyData]);


  if (isUserLoading || isLoadingCompany || !user || isLoadingAllOrders || isLoadingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (companyData?.isActive === false && pathname !== '/dashboard/settings') {
     return (
        <div className="flex min-h-screen items-center justify-center">
            <p>Verificando sua assinatura...</p>
        </div>
     )
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-background md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Package2 className="h-6 w-6 text-primary" />
              <span className="">DeliveryHub</span>
            </Link>
          </div>
          <div className="flex-1">
            <DashboardNav newOrdersCount={newOrdersCount} isAdmin={!!adminData} />
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Alternar menu de navegação</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <div className="flex h-14 items-center border-b px-4">
                 <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                   <Package2 className="h-6 w-6 text-primary" />
                   <span className="">DeliveryHub</span>
                 </Link>
              </div>
              <div className="mt-5 flex-1">
                <DashboardNav newOrdersCount={newOrdersCount} isAdmin={!!adminData} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <UserNav isAdmin={!!adminData} />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
