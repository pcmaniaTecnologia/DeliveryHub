'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useAuth, initiateAnonymousSignIn } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle } from 'lucide-react';

export default function WaiterLoginPage() {
    const params = useParams();
    const companyId = params?.companyId as string;
    const router = useRouter();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const [name, setName] = useState('');

    const companyRef = useMemoFirebase(() => {
        if (!firestore || !companyId) return null;
        return doc(firestore, 'companies', companyId);
    }, [firestore, companyId]);

    const { data: companyData, isLoading: isLoadingCompany } = useDoc(companyRef);

    useEffect(() => {
        // Auto-redirect if already identified
        if (companyId) {
            const savedName = localStorage.getItem(`waiter_name_${companyId}`);
            if (savedName) {
                router.replace(`/waiter/${companyId}/dashboard`);
            }
        }
    }, [companyId, router]);

    const handleIdentify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!name.trim()) return;

        try {
            // Background anonymous sign-in to get a valid Firebase UID
            // This is required to satisfy Firestore security rules for listing orders
            if (auth && !auth.currentUser) {
                await initiateAnonymousSignIn(auth);
            }

            // Save name to localStorage
            localStorage.setItem(`waiter_name_${companyId}`, name.trim());
            
            // Also save a session object for compatibility with components that expect it
            localStorage.setItem(`waiter_session_${companyId}`, JSON.stringify({
                id: auth?.currentUser?.uid || 'waiter_id_' + Date.now(),
                name: name.trim(),
                pin: ''
            }));

            toast({ title: 'Identificado!', description: `Bem-vindo(a), ${name}!` });
            router.push(`/waiter/${companyId}/dashboard`);
        } catch (error) {
            console.error("Waiter auth error:", error);
            toast({ 
                variant: "destructive", 
                title: 'Erro de conexão', 
                description: 'Não foi possível iniciar sua sessão. Verifique sua internet.' 
            });
        }
    };

    if (isLoadingCompany) {
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
                        <UserCircle className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">{companyData.name || 'Restaurante'}</CardTitle>
                        <CardDescription className="text-lg mt-1">Identificação do Garçom</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleIdentify}>
                    <CardContent className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-base">Digite seu nome para começar</Label>
                            <Input 
                                id="name"
                                className="h-14 text-lg border-2 focus-visible:ring-primary focus-visible:border-primary"
                                placeholder="Ex: João Silva"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full h-14 text-lg font-bold" disabled={!name.trim()}>Continuar para Mesas</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
