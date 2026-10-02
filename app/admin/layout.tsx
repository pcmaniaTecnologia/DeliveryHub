
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  Home,
  ShieldCheck,
  Building,
  DollarSign,
  Settings,
  Menu,
} from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserNav } from '@/components/user-nav';
import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

function AdminNav() {
    const pathname = usePathname();
    const navItems = [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/companies', label: 'Empresas', icon: Building },
        { href: '/admin/plans', label: 'Planos', icon: DollarSign },
        { href: '/admin/settings', label: 'Configurações', icon: Settings },
    ];

    return (
        <nav className="workspace-navigation grid items-start gap-1 px-3 py-5 text-sm font-medium">
        {navItems.map((item) => (
            <Link
            key={item.label}
            href={item.href}
            aria-current={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/')) ? 'page' : undefined}
            className={cn(
                'workspace-nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))) && 'is-active'
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
  const firestore = useFirestore();
  const router = useRouter();

  const adminRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user?.uid]);

  const { data: adminData, isLoading: isLoadingAdmin } = useDoc(adminRef);

  useEffect(() => {
    if (!isUserLoading && !isLoadingAdmin) {
      if (!user || user.isAnonymous) {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isLoadingAdmin, router]);

  if (isUserLoading || isLoadingAdmin) {
      return (
        <div className="flex min-h-screen items-center justify-center">
            <p>Verificando permissões de administrador...</p>
        </div>
    );
  }

  if (!user) {
    return (
       <div className="flex min-h-screen items-center justify-center">
            <p>Redirecionando para o login...</p>
        </div>
    );
  }
  
  if (!adminData) {
       return (
        <div className="flex min-h-screen items-center justify-center bg-muted p-4">
            <Card className="max-w-lg text-center">
                 <CardHeader>
                    <CardTitle className="text-destructive">Acesso Negado</CardTitle>
                    <CardDescription>
                        Você não tem permissão para acessar o painel de super administrador.
                    </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <p>Sua conta não foi encontrada no registro de administradores da plataforma. Se você acredita que isso é um erro, por favor, verifique se o documento de permissão foi criado corretamente no Firestore.</p>
                    <div className="text-left space-y-2 rounded-lg border bg-background p-4">
                        <p className="text-sm font-medium">Instruções para correção:</p>
                        <p className="text-sm text-muted-foreground">1. Acesse seu banco de dados Firestore.</p>
                        <p className="text-sm text-muted-foreground">2. Crie (ou verifique) uma coleção chamada: <code className="bg-muted p-1 rounded-sm">roles_admin</code></p>
                        <p className="text-sm text-muted-foreground">3. Dentro dela, crie um documento com o ID abaixo:</p>
                        <code className="block w-full truncate rounded-md bg-muted p-2 text-sm">{user.uid}</code>
                    </div>
                 </CardContent>
                 <CardFooter className="flex justify-center gap-2">
                    <Link href="/dashboard">
                        <Button>Ir para o Painel da Loja</Button>
                    </Link>
                 </CardFooter>
            </Card>
        </div>
    );
  }


  return (
    <div className="management-shell grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[256px_1fr]">
      <div className="workspace-sidebar sticky top-0 hidden h-screen border-r md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="workspace-brand flex h-20 items-center border-b px-5 lg:px-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-6 w-6 text-sky-400" />
              <span className="text-xl font-bold tracking-tight text-white">AdminHub</span>
            </Link>
          </div>
          <div className="flex-1">
            <AdminNav />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <header className="workspace-header sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 lg:px-8">
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
            <SheetContent side="left" className="workspace-mobile-menu workspace-sidebar flex flex-col p-0">
               <div className="flex h-14 items-center border-b px-4">
                 <Link href="/admin" className="flex items-center gap-2 font-semibold">
                   <ShieldCheck className="h-6 w-6 text-sky-400" />
                   <span className="text-xl font-bold tracking-tight text-white">AdminHub</span>
                 </Link>
              </div>
              <div className="mt-5 flex-1">
                <AdminNav />
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1" />
          <UserNav isAdmin={!!adminData} />
        </header>
        <main className="workspace-content flex min-w-0 flex-1 flex-col gap-5 p-4 md:gap-7 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
