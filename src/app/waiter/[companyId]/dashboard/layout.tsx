import { CartProvider } from '@/context/cart-context';
import WaiterCartSheet from '@/components/menu/waiter-cart-sheet';

export default function WaiterDashboardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { companyId: string };
}) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-background pb-20">
        {children}
        <WaiterCartSheet companyId={params.companyId} />
      </div>
    </CartProvider>
  );
}
