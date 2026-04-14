'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/firebase';
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
import { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email necessário',
        description: 'Por favor, insira seu endereço de e-mail.',
      });
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setIsSent(true);
      toast({
        title: 'E-mail enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
    } catch (error: any) {
      if (error instanceof FirebaseError && error.code === 'auth/user-not-found') {
        // To avoid user enumeration, we can show a generic message even if user not found.
        setIsSent(true); 
         toast({
            title: 'E-mail enviado!',
            description: 'Se uma conta com este e-mail existir, um link de redefinição será enviado.',
        });
      } else {
        console.error('Falha ao redefinir senha:', error);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: error.message || 'Ocorreu um erro ao tentar redefinir a senha.',
        });
      }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Package2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Esqueceu sua senha?</CardTitle>
          <CardDescription>
            {isSent 
                ? 'Verifique sua caixa de entrada e siga as instruções.'
                : 'Digite seu e-mail para receber um link de redefinição.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isSent ? (
                 <div className="text-center">
                    <p className="text-muted-foreground">Se você não receber um e-mail, verifique sua pasta de spam ou tente novamente.</p>
                 </div>
            ) : (
                <form onSubmit={handlePasswordReset}>
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
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Enviando...' : 'Enviar link de redefinição'}
                    </Button>
                    </div>
                </form>
            )}
            <div className="mt-4 text-center text-sm">
                <Link href="/" className="underline flex items-center justify-center gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
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
