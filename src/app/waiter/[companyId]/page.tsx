'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useAuth, initiateAnonymousSignIn, updateDocument } from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, Lock } from 'lucide-react';

export default function WaiterLoginPage() {
    const params = useParams();
    const companyId = params?.companyId as string;
    const router = useRouter();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

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
        
        if (!name.trim() || !pin.trim()) {
            toast({ variant: 'destructive', title: 'Preencha todos os campos' });
            return;
        }

        setIsLoggingIn(true);

        try {
            // 1. Background anonymous sign-in
            if (auth && !auth.currentUser) {
                await initiateAnonymousSignIn(auth);
            }

            const currentUid = auth?.currentUser?.uid;
            if (!currentUid) throw new Error("Falha na autenticação Firebase");

            // 2. Search for the waiter in Firestore
            const waitersRef = collection(firestore!, 'companies', companyId, 'waiters');
            const q = query(
                waitersRef, 
                where('name', '==', name.trim()), 
                where('pin', '==', pin.trim())
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ 
                    variant: 'destructive', 
                    title: 'Acesso Negado', 
                    description: 'Nome ou PIN incorretos. Verifique com seu gerente.' 
                });
                setIsLoggingIn(false);
                return;
            }

            // 3. Link the anonymous UID to this waiter profile
            const waiterDoc = querySnapshot.docs[0];
            const waiterRef = doc(firestore!, 'companies', companyId, 'waiters', waiterDoc.id);
            
            await updateDocument(waiterRef, {
                waiterUid: currentUid,
                lastLogin: new Date()
            });

            // 4. Save session to localStorage
            localStorage.setItem(`waiter_name_${companyId}`, name.trim());
            localStorage.setItem(`waiter_session_${companyId}`, JSON.stringify({
                id: waiterDoc.id,
                uid: currentUid,
                name: name.trim()
            }));

            toast({ title: 'Acesso Autorizado!', description: `Bem-vindo(a) de volta, ${name}!` });
            router.push(`/waiter/${companyId}/dashboard`);
        } catch (error) {
            console.error("Waiter auth error:", error);
            toast({ 
                variant: "destructive", 
                title: 'Erro no servidor', 
                description: 'Não foi possível validar seu acesso. Tente novamente.' 
            });
            setIsLoggingIn(false);
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
                        <CardDescription className="text-lg mt-1">Acesso da Equipe (Garçom)</CardDescription>
                    </div>
                </CardHeader>
                <form onSubmit={handleIdentify}>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">Seu Nome</Label>
                            <Input 
                                id="name"
                                className="h-12 border-2 focus-visible:ring-primary focus-visible:border-primary"
                                placeholder="Digite seu nome cadastrado"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pin" className="text-sm font-medium">PIN de Acesso</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                <Input 
                                    id="pin"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    className="h-12 pl-10 border-2 focus-visible:ring-primary focus-visible:border-primary"
                                    placeholder="Digite sua senha numérica"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button 
                            type="submit" 
                            className="w-full h-14 text-lg font-bold gap-2" 
                            disabled={isLoggingIn || !name.trim() || !pin.trim()}
                        >
                            {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Entrar no Sistema'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
