'use client';

import MenuPage from '@/app/menu/[companyId]/page';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';

export default function WaiterMenuPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const companyId = params?.companyId as string;
    const tableNumber = searchParams.get('table');
    const isAdmin = searchParams.get('admin') === 'true';
    
    const backUrl = isAdmin ? '/dashboard/comandas' : `/waiter/${companyId}/dashboard`;

    return (
        <div className="relative pb-10">
            <div className="sticky top-0 z-30 flex items-center gap-2 bg-background/95 p-4 backdrop-blur-sm border-b shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => router.push(backUrl)}>
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold">Mesa {tableNumber}</h2>
                    <p className="text-xs text-muted-foreground">Adicionando produtos na mesa.</p>
                </div>
            </div>
            {/* The normal MenuPage component */}
            <MenuPage />
        </div>
    );
}
