
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package2 } from 'lucide-react';
import { useUser, useAuth, initiateEmailSignUp, setDocument, useFirestore } from '@/firebase';
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
import { doc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import type { User, UserCredential } from 'firebase/auth';


async function createInitialDocuments(firestore: any, user: User, firstName: string, lastName: string) {
    if (!user || !firestore || !firstName || !lastName) return;
    
    const companyRef = doc(firestore, 'companies', user.uid);
    const companyData = {
        id: user.uid,
        ownerId: user.uid,
        name: `${firstName}'s Store`,
        email: user.email,
        isActive: false, // New companies start as inactive until they subscribe.
        planId: null,
        subscriptionEndDate: null,
    };

    const companyUserRef = doc(firestore, 'companies', user.uid, 'users', user.uid);
    const companyUserData = {
        id: user.uid,
        companyId: user.uid,
        firstName,
        lastName,
        email: user.email,
        role: 'admin', // The user is an admin of their own company
    };
    
    const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
    const adminRoleData = {
        email: user.email,
    };

    // The setDocument function from @/firebase will handle emitting contextual errors
    await Promise.all([
        setDocument(companyRef, companyData, { merge: true }),
        setDocument(companyUserRef, companyUserData, { merge: true }),
        setDocument(adminRoleRef, adminRoleData, { merge: true }),
    ]);
}


export default function SignupPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();


  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Erro de sistema',
            description: 'Serviço de autenticação não está disponível.',
        });
        return;
    }
     if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erro de cadastro',
        description: 'As senhas não coincidem.',
      });
      return;
    }
    if (!firstName || !lastName || !email || !password) {
        toast({
            variant: 'destructive',
            title: 'Erro de cadastro',
            description: 'Por favor, preencha todos os campos.',
        });
        return;
    }

    setIsLoading(true);

    let userCredential: UserCredential;
    try {
      userCredential = await initiateEmailSignUp(auth, email, password);
    } catch (error: any) {
        if (error instanceof FirebaseError && error.code === 'auth/email-already-in-use') {
            toast({
            variant: 'destructive',
            title: 'E-mail já cadastrado',
            description: 'Este e-mail já está em uso. Tente fazer login ou use um e-mail diferente.',
            });
        } else if (error instanceof FirebaseError && error.code === 'auth/weak-password') {
            toast({
                variant: 'destructive',
                title: 'Senha muito fraca',
                description: 'A senha deve ter pelo menos 6 caracteres.',
            });
        } else {
            toast({
            variant: 'destructive',
            title: 'Erro de autenticação',
            description: error.message || 'Ocorreu um erro ao tentar criar a conta.',
            });
      }
      setIsLoading(false);
      return;
    }

    // If auth succeeds, proceed to create documents.
    // Errors here will now be thrown and caught by the global error handler.
    if (firestore && userCredential.user) {
        await createInitialDocuments(firestore, userCredential.user, firstName, lastName);
    } else {
        toast({
            variant: 'destructive',
            title: 'Erro de sistema',
            description: 'Não foi possível inicializar o banco de dados para criar os documentos iniciais.',
        });
        setIsLoading(false);
        return;
    }
       
    toast({
      title: 'Conta criada com sucesso!',
      description: 'Bem-vindo ao DeliveryHub! Sua loja foi criada e está pronta para ser configurada.',
    });
    // Let the useEffect handle redirect, setIsLoading(false) is not strictly needed
  };


  if (isUserLoading || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Package2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar uma conta</CardTitle>
          <CardDescription>Insira seus dados para se cadastrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="first-name">Nome</Label>
                  <Input id="first-name" placeholder="Wellington" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name">Sobrenome</Label>
                  <Input id="last-name" placeholder="Henrique" required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isLoading} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="suporte@pcmania.net"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Já tem uma conta?{' '}
            <Link href="/" className="underline">
              Entrar
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
