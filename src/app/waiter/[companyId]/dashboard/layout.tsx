import { CartProvider } from '@/context/cart-context';
import WaiterCartSheet from '@/components/menu/waiter-cart-sheet';
import { Suspense } from 'react';

export default async function WaiterDashboardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return (
    <CartProvider>
      <div className="min-h-screen bg-background pb-20">
        {children}
        <Suspense fallback={null}>
            <WaiterCartSheet companyId={companyId} />
        </Suspense>
      </div>
    </CartProvider>
  );
}
