
'use client';

import { useEffect } from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { hexToHsl } from '@/lib/utils';
import { Package2 } from 'lucide-react';
import Link from 'next/link';
import { CartProvider } from '@/context/cart-context';
import CartSheet from '@/components/menu/cart-sheet';
import { useParams } from 'next/navigation';


type CompanyData = {
    themeColors?: string;
};

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const firestore = useFirestore();
  const params = useParams();
  const companyId = params.companyId as string;

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !companyId) return null;
    return doc(firestore, 'companies', companyId);
  }, [firestore, companyId]);

  const { data: companyData, isLoading } = useDoc<CompanyData>(companyRef);

  useEffect(() => {
    if (companyData?.themeColors) {
        try {
            const { primary, accent, background } = JSON.parse(companyData.themeColors);
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
             if (background) {
                const backgroundHsl = hexToHsl(background);
                if (backgroundHsl) {
                  document.documentElement.style.setProperty('--background', `${backgroundHsl.h} ${backgroundHsl.s}% ${backgroundHsl.l}%`);
                  document.documentElement.style.setProperty('--card', `${backgroundHsl.h} ${backgroundHsl.s}% ${backgroundHsl.l}%`);
                  document.documentElement.style.setProperty('--popover', `${backgroundHsl.h} ${backgroundHsl.s}% ${backgroundHsl.l}%`);
                }
            }
        } catch (error) {
            console.error("Failed to parse or apply theme colors:", error);
        }
    }
}, [companyData]);

  return (
    <CartProvider>
        <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
            <nav className="flex w-full items-center justify-between text-lg font-medium">
            <Link
                href={`/menu/${companyId}`}
                className="flex items-center gap-2 text-lg font-semibold"
            >
                <Package2 className="h-6 w-6 text-primary" />
                <span className="sr-only">Menu</span>
            </Link>
             <Link href="/track" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Acompanhar Pedido
            </Link>
            </nav>
        </header>
        <main>{children}</main>
            <CartSheet companyId={companyId} />
            <footer className="mt-12 border-t py-6">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} DeliveryHub. Todos os direitos reservados.</p>
                    <p className="mt-1">
                        Desenvolvido por <a href="#" className="underline">PC MANIA</a>
                    </p>
                </div>
            </footer>
        </div>
    </CartProvider>
  );
}
