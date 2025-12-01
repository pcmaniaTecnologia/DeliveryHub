'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package2 } from 'lucide-react';
import { useUser, useAuth, initiateEmailSignIn } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Erro de login',
        description: 'Por favor, preencha o e-mail e a senha.',
      });
      return;
    }
    setIsLoading(true);
    try {
      initiateEmailSignIn(auth, email, password);
    } catch (error: any) {
      console.error('Falha no login:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de login',
        description: error.message || 'Ocorreu um erro ao tentar fazer login.',
      });
      setIsLoading(false);
    }
    // O estado de loading será controlado pelo `onAuthStateChanged` e `isUserLoading`
  };

  if (isUserLoading || user) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <p>Carregando...</p>
        </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Package2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">BEM VINDO AO DeliveryHub</CardTitle>
          <CardDescription>Digite seu e-mail abaixo para fazer login em sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@exemplo.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    href="#"
                    className="ml-auto inline-block text-sm underline"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Não tem uma conta?{' '}
            <Link href="/signup" className="underline">
              Inscreva-se
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Criado por PC MANIA
      </div>
    </div>
  );
}
