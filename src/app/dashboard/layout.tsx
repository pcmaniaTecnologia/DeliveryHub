
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
import { NotificationProvider, useNotifications } from '@/context/notification-context';

const notificationSoundUrl = "https://storage.googleapis.com/starlit-id-prod.appspot.com/public-assets/notification.mp3";

type CompanyData = {
    themeColors?: string;
    soundNotificationEnabled?: boolean;
    autoPrintEnabled?: boolean;
    isActive?: boolean;
    planId?: string;
    subscriptionEndDate?: Timestamp;
    name?: string;
};

// A component to handle sound playback, to be used inside the layout
const SoundPlayer = () => {
    const { playTrigger } = useNotifications();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (playTrigger > 0 && audioRef.current) {
            audioRef.current.play().catch(error => {
                // This error is expected if the user hasn't interacted with the page yet.
                // It can be safely ignored in many cases.
                console.warn("Audio playback failed, likely due to browser autoplay policy. User interaction is required to enable sound.", error);
            });
        }
    }, [playTrigger]);

    return <audio ref={audioRef} src={notificationSoundUrl} preload="auto" />;
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
    <NotificationProvider companyData={companyData}>
      <SoundPlayer />
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
    </NotificationProvider>
  );
}
