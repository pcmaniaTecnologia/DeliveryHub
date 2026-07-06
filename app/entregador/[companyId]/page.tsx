'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Bike, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function CourierLoginPage({ params }: { params: { companyId: string } }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const savedCourier = localStorage.getItem(`courier_${params.companyId}`);
    if (savedCourier) {
      router.push(`/entregador/${params.companyId}/dashboard`);
    }
  }, [params.companyId, router]);

  // Fetch company data to show name
  const companyRef = firestore ? doc(firestore, 'companies', params.companyId) : null;
  const { data: company, isLoading: isLoadingCompany } = useDoc<any>(companyRef);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin) {
      toast({ title: 'Preencha os dados', description: 'Telefone e PIN são obrigatórios.', variant: 'destructive' });
      return;
    }

    if (!firestore) return;
    setIsLoading(true);

    try {
      const couriersRef = collection(firestore, `companies/${params.companyId}/couriers`);
      const q = query(couriersRef, where('phone', '==', phone), where('pinCode', '==', pin), where('active', '==', true));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: 'Acesso negado', description: 'Telefone ou PIN incorretos, ou entregador inativo.', variant: 'destructive' });
      } else {
        const courierDoc = querySnapshot.docs[0];
        const courierData = { id: courierDoc.id, ...courierDoc.data() };
        
        localStorage.setItem(`courier_${params.companyId}`, JSON.stringify(courierData));
        toast({ title: 'Login com sucesso!' });
        router.push(`/entregador/${params.companyId}/dashboard`);
      }
    } catch (error) {
      toast({ title: 'Erro de conexão', description: 'Não foi possível fazer o login.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingCompany) return <LoadingScreen />;

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
             <CardTitle className="text-destructive text-center">Empresa não encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm border-t-4 border-t-primary shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary">
            <Bike className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Portal do Entregador</CardTitle>
          <CardDescription className="text-sm mt-1">{company.name}</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (Cadastrado)</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="Ex: 33988887777" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN de Acesso</Label>
              <Input 
                id="pin" 
                type="password" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Digite seu PIN" 
                value={pin} 
                onChange={(e) => setPin(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
