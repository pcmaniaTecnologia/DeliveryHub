
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Package2,
} from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { DashboardNav } from '@/components/dashboard-nav';
import { useUser } from '@/firebase';
import { hexToHsl } from '@/lib/utils';
import type { Order } from './orders/page';

type CompanyData = {
    themeColors?: string;
    soundNotificationEnabled?: boolean;
    isActive?: boolean;
    planId?: string;
    subscriptionEndDate?: any;
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
  const previousOrdersRef = useRef<Order[]>([]);


  const companyRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'companies', user.uid);
  }, [firestore, user?.uid]);

  const { data: companyData, isLoading: isLoadingCompany } = useDoc<CompanyData>(companyRef);

  const ordersRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, `companies/${user.uid}/orders`);
  }, [firestore, user?.uid]);

  const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersRef);
  
  const newOrdersCount = useMemo(() => {
    if (!orders) return 0;
    return orders.filter(order => order.status === 'Novo' || order.status === 'Aguardando pagamento').length;
  }, [orders]);


  useEffect(() => {
    // This effect handles the audio initialization and user interaction detection
    const handleFirstInteraction = () => {
        if (!hasInteracted) {
            setHasInteracted(true);
            if (audioRef.current) {
                audioRef.current.load(); // Pre-load the audio on first interaction
            }
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };

    audioRef.current = new Audio(notificationSound);
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    };
}, [hasInteracted]);

  // This effect detects new orders and triggers sound
  useEffect(() => {
      if (!orders || isLoadingOrders || !companyData?.soundNotificationEnabled || !hasInteracted || !audioRef.current) {
          return;
      }
      
      // Don't play sound on initial load
      if (previousOrdersRef.current.length === 0 && orders.length > 0) {
        previousOrdersRef.current = orders;
        return;
      }

      // Get the list of order IDs from the previous state
      const previousOrderIds = new Set(previousOrdersRef.current.map(o => o.id));

      // Find orders that are new (not in the previous list) and have the 'Novo' status
      const newOrders = orders.filter(order => 
          !previousOrderIds.has(order.id) && (order.status === 'Novo' || order.status === 'Aguardando pagamento')
      );

      if (newOrders.length > 0) {
          // Play sound
          if (audioRef.current.paused) {
              audioRef.current.play().catch(err => console.error("Audio playback failed:", err));
          }
      }

      // Update the previous orders ref for the next render
      previousOrdersRef.current = orders;

  }, [orders, isLoadingOrders, companyData, hasInteracted]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

   useEffect(() => {
    // Check if company data is loaded and if the company is inactive
    if (!isLoadingCompany && companyData && companyData.isActive === false) {
        // If the user is not already on the settings page, redirect them.
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


  if (isUserLoading || isLoadingCompany || !user || isLoadingOrders) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  // If company is inactive and we're not on the settings page, show loading while redirecting.
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
            <DashboardNav newOrdersCount={newOrdersCount} />
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
                <DashboardNav newOrdersCount={newOrdersCount} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <UserNav />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
