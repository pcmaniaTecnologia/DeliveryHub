'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package2 } from 'lucide-react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useUser, useAuth, initiateEmailSignIn } from '@/firebase';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';

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
    if (!auth) return;
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
      await initiateEmailSignIn(auth, email, password);
      // The redirect is handled by the useEffect hook watching the user state.
    } catch (error: any) {
      if (error instanceof FirebaseError && (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found')) {
         toast({
            variant: 'destructive',
            title: 'Credenciais inválidas',
            description: 'Verifique seu e-mail e senha.',
         });
      } else {
        console.error('Falha no login:', error);
        toast({
          variant: 'destructive',
          title: 'Erro de login',
          description: error.message || 'Ocorreu um erro ao tentar fazer login.',
        });
      }
      setIsLoading(false);
    }
  };

  if (isUserLoading || user) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="mb-2 flex justify-center">
          <img src="/logo.png" alt="DeliveryHub" className="h-48 sm:h-64 md:h-80 w-auto object-contain animate-in fade-in zoom-in duration-500" />
        </div>
        <p className="text-sm text-muted-foreground">Digite seu e-mail abaixo para fazer login em sua conta</p>
      </div>
      <div className="bg-background/80 backdrop-blur-sm p-6 rounded-xl border shadow-sm">
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
                    href="/forgot-password"
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
        </div>
      <div className="mt-8 text-center text-lg text-muted-foreground font-semibold space-y-2">
        <p>Criado por PC MANIA</p>
        <p>
            <a href="https://www.pcmania.net" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors font-bold underline-offset-4 hover:underline">
                www.pcmania.net
            </a>
        </p>
      </div>
    </div>
  </div>
  );
}
