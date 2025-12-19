
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, Package, Ticket, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function DashboardNav({ newOrdersCount = 0 }: { newOrdersCount?: number }) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Painel', icon: Home },
    { href: '/dashboard/orders', label: 'Pedidos', icon: ShoppingCart, badge: newOrdersCount > 0 ? newOrdersCount.toString() : undefined },
    { href: '/dashboard/products', label: 'Produtos', icon: Package },
    { href: '/dashboard/coupons', label: 'Cupons', icon: Ticket },
    { href: '/dashboard/settings', label: 'Configurações', icon: SettingsIcon },
  ];

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
    </nav>
  );
}
