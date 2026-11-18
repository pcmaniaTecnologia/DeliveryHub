'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [pixKey, setPixKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpWebhookSecret, setMpWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsLoadingSettings(false);
      return;
    }

    let active = true;
    setWebhookUrl(`${window.location.origin}/api/payments/webhook`);
    setIsLoadingSettings(true);
    void (async () => {
      try {
        const response = await fetch('/api/admin/platform-settings', {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as configurações.');
        if (active) {
          setPixKey(data.pixKey || '');
          setMpAccessToken(data.mpAccessToken || '');
          setMpWebhookSecret(data.mpWebhookSecret || '');
        }
      } catch (error) {
        if (active) {
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar configurações',
            description: error instanceof Error ? error.message : 'Tente novamente.',
          });
        }
      } finally {
        if (active) setIsLoadingSettings(false);
      }
    })();
    return () => { active = false; };
  }, [user, isUserLoading, toast]);

  const handleSaveChanges = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/platform-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ pixKey, mpAccessToken, mpWebhookSecret }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar as configurações.');
      toast({ title: 'Sucesso!', description: 'As configurações da plataforma foram salvas.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Não foi possível atualizar as configurações.',
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
        <CardDescription>Gerencie as configurações globais do seu sistema SaaS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="pix-key">Chave PIX Principal</Label>
          <Input
            id="pix-key"
            value={pixKey}
            onChange={event => setPixKey(event.target.value)}
            placeholder="Insira a chave PIX para receber os pagamentos das assinaturas"
            disabled={isLoading || isSaving}
          />
          <p className="text-sm text-muted-foreground">Esta chave será exibida para os lojistas que escolherem o PIX manual.</p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="mp-token">Access Token - Mercado Pago (PRODUÇÃO)</Label>
          <Input
            id="mp-token"
            type="password"
            value={mpAccessToken}
            onChange={event => setMpAccessToken(event.target.value)}
            placeholder="APP_USR-000000000-000000-0000000000"
            disabled={isLoading || isSaving}
          />
          <p className="text-sm text-muted-foreground">O token é salvo em uma área privada e usado somente pelo servidor para iniciar e confirmar cobranças.</p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="mp-webhook-secret">Segredo da assinatura do Webhook</Label>
          <Input
            id="mp-webhook-secret"
            type="password"
            value={mpWebhookSecret}
            onChange={event => setMpWebhookSecret(event.target.value)}
            placeholder="Cole aqui o segredo gerado no painel Mercado Pago"
            disabled={isLoading || isSaving}
          />
          <p className="text-sm text-muted-foreground">Este segredo valida se as notificações recebidas foram enviadas pelo Mercado Pago.</p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>Notificações para renovação automática</Label>
          <p className="break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">{webhookUrl || 'https://seu-dominio/api/payments/webhook'}</p>
          <p className="text-sm text-muted-foreground">
            No painel de desenvolvedores do Mercado Pago, configure este endereço em Webhooks e ative os eventos <strong>Pagamentos</strong>, <strong>Planos e assinaturas</strong> (pagamentos autorizados) e <strong>Assinaturas</strong> (pré-aprovação). Depois, cole o segredo gerado no campo acima e salve.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveChanges} disabled={isLoading || isSaving || !user}>
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </CardFooter>
    </Card>
  );
}
