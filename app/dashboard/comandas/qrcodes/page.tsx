'use client';

import { LoadingScreen } from '@/components/LoadingScreen';

import React, { useMemo, useEffect, useState } from 'react';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useImpersonation } from '@/context/impersonation-context';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function QRCodesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { isImpersonating, impersonatedCompanyId } = useImpersonation();
    const router = useRouter();
    const [origin, setOrigin] = useState('');

    const effectiveCompanyId = isImpersonating ? impersonatedCompanyId : user?.uid;

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !effectiveCompanyId) return null;
        return doc(firestore, 'companies', effectiveCompanyId);
    }, [firestore, effectiveCompanyId]);

    const { data: companyData, isLoading } = useDoc<{ numberOfTables?: number; name?: string }>(companyRef);

    const numTables = companyData?.numberOfTables || 0;

    const tables = useMemo(() => {
        return Array.from({ length: numTables }, (_, i) => i + 1);
    }, [numTables]);

    const getQRUrl = (tableNum: number) => {
        const menuUrl = `${origin}/menu/${effectiveCompanyId}?table=${tableNum}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`;
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <>
            {/* Screen header - hidden when printing */}
            <div className="print:hidden space-y-4 mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/comandas')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">QR Codes das Mesas</h2>
                        <p className="text-muted-foreground">Imprima e cole em cada mesa para autoatendimento.</p>
                    </div>
                </div>
                <Button className="gap-2" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Imprimir QR Codes
                </Button>
            </div>

            {numTables === 0 ? (
                <div className="text-center py-16 print:hidden">
                    <p className="text-lg text-muted-foreground">Nenhuma mesa configurada. Vá em <strong>Configurações → Empresa</strong> e defina o número de mesas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
                    {tables.map((tableNum) => (
                        <div
                            key={tableNum}
                            className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-2xl p-4 bg-white print:break-inside-avoid print:border-solid print:border-black/20 print:rounded-lg print:p-3"
                        >
                            <p className="text-xs text-muted-foreground mb-1 print:text-[10px] print:text-black/50">
                                {companyData?.name || 'Restaurante'}
                            </p>
                            <h3 className="text-xl font-black mb-2 print:text-lg print:mb-1">
                                Mesa {tableNum}
                            </h3>
                            {origin && (
                                <img
                                    src={getQRUrl(tableNum)}
                                    alt={`QR Code Mesa ${tableNum}`}
                                    width={160}
                                    height={160}
                                    className="rounded-md print:w-[120px] print:h-[120px]"
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground mt-2 text-center print:text-[8px] print:text-black/40">
                                Escaneie para fazer seu pedido
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Print-specific styles */}
            <style jsx global>{`
                @media print {
                    body { background: white !important; -webkit-print-color-adjust: exact; }
                    nav, header, footer, .print\\:hidden { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; }
                    @page { margin: 1cm; }
                }
            `}</style>
        </>
    );
}
