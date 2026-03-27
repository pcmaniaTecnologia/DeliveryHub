'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UtensilsCrossed } from 'lucide-react';

type Waiter = {
  id: string;
  name: string;
  pin: string;
  isActive: boolean;
};

export default function WaiterLoginPage({ params }: { params: { companyId: string } }) {
    const { companyId } = params;
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [pin, setPin] = useState('');

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return doc(firestore, 'companies', companyId);
    }, [firestore, companyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc(companyRef);

    const waitersRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return collection(firestore, 'companies', companyId, 'waiters');
    }, [firestore, companyId]);

    const { data: waiters, isLoading: isLoadingWaiters } = useCollection<Waiter>(waitersRef);

    useEffect(() => {
        // Auto-redirect if already logged in for this company
        const savedSession = localStorage.getItem(`waiter_session_${companyId}`);
        if (savedSession) {
            router.replace(`/waiter/${companyId}/dashboard`);
        }
    }, [companyId, router]);

    const handleLogin = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!waiters) return;

        const waiter = waiters.find(w => w.pin === pin && w.isActive);

        if (waiter) {
            localStorage.setItem(`waiter_session_${companyId}`, JSON.stringify({
                id: waiter.id,
                name: waiter.name,
                pin: waiter.pin
            }));
            
            toast({ title: 'Acesso Liberado', description: `Bem-vindo, ${waiter.name}!` });
            router.push(`/waiter/${companyId}/dashboard`);
        } else {
            toast({ variant: 'destructive', title: 'Acesso Negado', description: 'PIN incorreto ou garçom inativo.' });
            setPin('');
        }
    };

    if (isLoadingCompany || isLoadingWaiters) {
         return <div className="flex h-screen items-center justify-center bg-muted/20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (!companyData || companyData.isActive === false) {
        return <div className="flex h-screen items-center justify-center p-4 text-center"><h1>Restaurante não disponível.</h1></div>;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md shadow-xl border-primary/20">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center">
                        <UtensilsCrossed className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">{companyData.name || 'Restaurante'}</CardTitle>
                        <CardDescription className="text-lg mt-1">Acesso do Garçom</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-6 pt-4">
                        <div className="space-y-2 text-center">
                            <Label htmlFor="pin" className="text-lg">Digite seu PIN Numérico</Label>
                            <Input 
                                id="pin"
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="text-center text-4xl tracking-widest h-16 w-full max-w-[200px] mx-auto border-2 focus-visible:ring-primary focus-visible:border-primary"
                                placeholder="****"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={pin.length < 4}>Acessar Mesas</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
