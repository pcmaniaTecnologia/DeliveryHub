'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Package, Ticket, Settings as SettingsIcon, ShieldCheck, ClipboardList, Store, BarChart3, Bike, Banknote, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';

export function DashboardNav({ newOrdersCount = 0, isAdmin = false, comandasEnabled = true, onNavItemClick }: { newOrdersCount?: number, isAdmin?: boolean, comandasEnabled?: boolean, onNavItemClick?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Painel', icon: Home },
    { href: '/dashboard/sales', label: 'PDV', icon: Store },
    { href: '/dashboard/orders', label: 'Pedidos', icon: ShoppingCart, badge: newOrdersCount > 0 ? newOrdersCount.toString() : undefined },
    { href: '/dashboard/reports', label: 'Relatórios', icon: BarChart3 },
    { href: '/dashboard/receivables', label: 'Receber', icon: Banknote },
    { href: '/dashboard/payables', label: 'Pagar', icon: CreditCard },
    ...(comandasEnabled ? [{ href: '/dashboard/comandas', label: 'Comandas', icon: ClipboardList }] : []),
    { href: '/dashboard/products', label: 'Produtos', icon: Package },
    { href: '/dashboard/coupons', label: 'Cupons', icon: Ticket },
    { href: '/dashboard/couriers', label: 'Entregadores', icon: Bike },
    { href: '/dashboard/settings', label: 'Configurações', icon: SettingsIcon },
  ];

  const adminNavItem = { href: '/admin', label: 'Painel Do Administrador', icon: ShieldCheck };

  return (
    <nav className="workspace-navigation grid items-start gap-1 px-3 text-sm font-medium">
      <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Menu principal</p>
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            'workspace-nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
            { 'is-active': pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')) }
          )}
          aria-current={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/')) ? 'page' : undefined}
          onClick={onNavItemClick}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {item.badge && <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">{item.badge}</Badge>}
        </Link>
      ))}
      {isAdmin && (
        <>
            <Separator className="my-3 bg-white/10" />
            <Link
                href={adminNavItem.href}
                className={cn(
                    'workspace-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                     pathname.startsWith(adminNavItem.href) && 'is-active'
                )}
                onClick={onNavItemClick}
            >
                <adminNavItem.icon className="h-4 w-4" />
                {adminNavItem.label}
            </Link>
        </>
      )}
    </nav>
  );
}
