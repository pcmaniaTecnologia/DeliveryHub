
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { useUser } from '@/firebase';
import { Menu } from 'lucide-react';

function AdminNav() {
    const pathname = usePathname();
    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/companies', label: 'Empresas', icon: Building },
    ];

    return (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
        {navItems.map((item) => (
            <Link
            key={item.label}
            href={item.href}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                { 'bg-muted text-primary': pathname.startsWith(item.href) && (item.href === '/admin' ? pathname === item.href : true) }
            )}
            >
            <item.icon className="h-4 w-4" />
            {item.label}
            </Link>
        ))}
        </nav>
    );
}


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user?.uid]);

  const { data: adminData, isLoading: isLoadingAdmin } = useDoc(adminRef);

  useEffect(() => {
    const isCheckingPermissions = isUserLoading || isLoadingAdmin;

    // Se ainda estiver verificando, não faça nada.
    if (isCheckingPermissions) {
      return;
    }

    // Após a verificação, se o usuário não tiver dados de admin, redirecione.
    if (!adminData) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, adminData, isLoadingAdmin, router]);
  
  const isCheckingPermissions = isUserLoading || isLoadingAdmin;

  // Enquanto verifica, mostre um estado de carregamento.
  if (isCheckingPermissions) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Verificando permissões de administrador...</p>
      </div>
    );
  }
  
  // Se, após a verificação, não for admin, mostre um estado de redirecionamento (ou nada).
  if (!adminData) {
     return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Acesso negado. Redirecionando...</p>
      </div>
    );
  }

  // Se for admin, renderize o layout.
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-background md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-6 w-6 text-destructive" />
              <span className="">AdminHub</span>
            </Link>
          </div>
          <div className="flex-1">
            <AdminNav />
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
                <span className="sr-only">Alternar menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
               <div className="flex h-14 items-center border-b px-4">
                 <Link href="/admin" className="flex items-center gap-2 font-semibold">
                   <ShieldCheck className="h-6 w-6 text-destructive" />
                   <span className="">AdminHub</span>
                 </Link>
              </div>
              <div className="mt-5 flex-1">
                <AdminNav />
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <UserNav isAdmin={true} />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
