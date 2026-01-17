
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useDoc, useMemoFirebase, useUser, setDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type PlatformSettings = {
    pixKey?: string;
};

export default function AdminSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [pixKey, setPixKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
      if (!firestore) return null;
      // Using a singleton document for platform-wide settings
      return doc(firestore, 'platform_settings', 'main');
  }, [firestore]);
  
  const { data: settingsData, isLoading: isLoadingSettings } = useDoc<PlatformSettings>(settingsRef);

  useEffect(() => {
    if (settingsData) {
      setPixKey(settingsData.pixKey || '');
    }
  }, [settingsData]);

  const handleSaveChanges = async () => {
    if (!settingsRef) return;

    setIsSaving(true);
    try {
        await setDocument(settingsRef, { pixKey });
        toast({
            title: 'Sucesso!',
            description: 'As configurações da plataforma foram salvas.',
        });
    } catch (error) {
        console.error("Failed to save platform settings:", error);
        toast({
            variant: 'destructive',
            title: 'Erro ao Salvar',
            description: 'Você não tem permissão para alterar estas configurações.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const isLoading = isUserLoading || isLoadingSettings;

  return (
    <Card>
        <CardHeader>
        <CardTitle>Configurações da Plataforma</CardTitle>
        <CardDescription>
            Gerencie as configurações globais do seu sistema SaaS.
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX Principal</Label>
            <Input 
                id="pix-key" 
                value={pixKey} 
                onChange={(e) => setPixKey(e.target.value)} 
                placeholder="Insira a chave PIX para receber os pagamentos das assinaturas"
                disabled={isLoading || isSaving} 
            />
            <p className="text-sm text-muted-foreground">
                Esta chave será exibida para os novos lojistas realizarem o pagamento da assinatura.
            </p>
        </div>
        </CardContent>
        <CardFooter>
        <Button onClick={handleSaveChanges} disabled={isLoading || isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
        </CardFooter>
    </Card>
  );
}

    