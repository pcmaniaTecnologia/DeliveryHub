'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package2 } from 'lucide-react';
import { useUser, useAuth, initiateEmailSignUp, setDocumentNonBlocking } from '@/firebase';
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
import { doc, getFirestore } from 'firebase/firestore';

export default function SignupPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const auth = useAuth();
  const firestore = getFirestore();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingDocs, setIsCreatingDocs] = useState(false);


  useEffect(() => {
    if (!isUserLoading && user && !isCreatingDocs) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router, isCreatingDocs]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
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
    try {
      // This will create the user in Firebase Auth and automatically sign them in
      initiateEmailSignUp(auth, email, password);
      // We don't await because the onAuthStateChanged listener will handle redirection
    } catch (error: any) {
      console.error('Falha no cadastro:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de cadastro',
        description: error.message || 'Ocorreu um erro ao tentar criar a conta.',
      });
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // When the user is created and authenticated by onAuthStateChanged
    if (user && !isUserLoading && firstName && lastName) {
        setIsCreatingDocs(true);

        const customerRef = doc(firestore, 'customers', user.uid);
        const customerData = {
            id: user.uid,
            firstName,
            lastName,
            email: user.email,
            phone: user.phoneNumber || '',
            address: ''
        };

        // Create the company/owner document. The ownerId is the user's UID.
        const companyRef = doc(firestore, 'companies', user.uid);
        const companyData = {
            id: user.uid,
            ownerId: user.uid,
            name: `${firstName}'s Store`, // Default company name
        };

        // Create the user document within the company's users subcollection
        // This user is the company owner, so they get the 'admin' role.
        const companyUserRef = doc(firestore, 'companies', user.uid, 'users', user.uid);
        const companyUserData = {
            id: user.uid,
            companyId: user.uid,
            firstName,
            lastName,
            email: user.email,
            role: 'admin', // Assign admin role to the creator
        };

        // Use non-blocking writes for all three documents
        setDocumentNonBlocking(customerRef, customerData, { merge: true });
        setDocumentNonBlocking(companyRef, companyData, { merge: true });
        setDocumentNonBlocking(companyUserRef, companyUserData, { merge: true });
        
        // After initiating writes, we can redirect.
        router.push('/dashboard');
    }
  }, [user, isUserLoading, router, firestore, firstName, lastName]);


  if (isUserLoading || (user && !isCreatingDocs)) {
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
                  <Input id="first-name" placeholder="João" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isLoading} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name">Sobrenome</Label>
                  <Input id="last-name" placeholder="Silva" required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isLoading} />
                </div>
              </div>
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
