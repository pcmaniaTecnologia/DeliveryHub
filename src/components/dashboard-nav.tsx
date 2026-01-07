
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Package, Ticket, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';

export function DashboardNav({ newOrdersCount = 0, isAdmin = false }: { newOrdersCount?: number, isAdmin?: boolean }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'não esta funcionando', icon: Home },
    { href: '/dashboard/orders', label: 'Pedidos', icon: ShoppingCart, badge: newOrdersCount > 0 ? newOrdersCount.toString() : undefined },
    { href: '/dashboard/products', label: 'Produtos', icon: Package },
    { href: '/dashboard/coupons', label: 'Cupons', icon: Ticket },
    { href: '/dashboard/settings', label: 'Configurações', icon: SettingsIcon },
  ];

  const adminNavItem = { href: '/admin', label: 'Painel do Admin', icon: ShieldCheck };

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            { 'bg-muted text-primary': pathname === item.href }
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {item.badge && <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">{item.badge}</Badge>}
        </Link>
      ))}
      {isAdmin && (
        <>
            <Separator className="my-2" />
            <Link
                href={adminNavItem.href}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-destructive transition-all hover:bg-destructive/10',
                     pathname.startsWith(adminNavItem.href) && 'bg-destructive/10'
                )}
            >
                <adminNavItem.icon className="h-4 w-4" />
                {adminNavItem.label}
            </Link>
        </>
      )}
    </nav>
  );
}
