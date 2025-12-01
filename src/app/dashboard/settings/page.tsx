'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Clock, DollarSign, PlusCircle, Trash2 } from 'lucide-react';
import { useFirestore, useDoc, setDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc, DocumentReference, DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const deliveryZones = [
  { neighborhood: 'Centro', fee: 'R$5,00', time: '30 min', active: true },
  { neighborhood: 'Bela Vista', fee: 'R$7,00', time: '45 min', active: true },
  { neighborhood: 'Jardins', fee: 'R$10,00', time: '50 min', active: false },
];

// Mock company ID
const COMPANY_ID = 'the-burger-shop';

export default function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const companyRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return doc(firestore, 'companies', COMPANY_ID)
  }, [firestore]);
  
  const { data: companyData, isLoading: isLoadingCompany } = useDoc(companyRef);

  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#29ABE2');
  const [accentColor, setAccentColor] = useState('#29E2D1');

  useEffect(() => {
    if (companyData) {
      setStoreName(companyData.name || '');
      setPhone(companyData.phone || '');
      if (companyData.themeColors) {
        try {
          const colors = JSON.parse(companyData.themeColors);
          setPrimaryColor(colors.primary || '#29ABE2');
          setAccentColor(colors.accent || '#29E2D1');
        } catch (e) {
          console.error("Error parsing theme colors", e);
        }
      }
    }
  }, [companyData]);

  const handleSaveChanges = () => {
    if (!companyRef) return;

    const themeColors = JSON.stringify({
        primary: primaryColor,
        accent: accentColor,
    });

    const updatedData = {
        name: storeName,
        phone: phone,
        themeColors: themeColors,
    };

    setDocumentNonBlocking(companyRef, updatedData, { merge: true });
    
    toast({
        title: 'Sucesso!',
        description: 'As configurações da sua empresa foram salvas.',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua loja e conta.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="profile">Empresa</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="notifications">Mensagens</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Perfil da Empresa</CardTitle>
              <CardDescription>
                Atualize as informações e a aparência da sua loja.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="store-name">Nome da Loja</Label>
                <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={isLoadingCompany} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logomarca</Label>
                <Input id="logo" type="file" disabled={isLoadingCompany} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone/WhatsApp</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isLoadingCompany}/>
              </div>
              <div className="space-y-2">
                <Label>Cores do Tema</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="primary-color">Primária</Label>
                    <Input id="primary-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-14 p-1" disabled={isLoadingCompany} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accent-color">Destaque</Label>
                    <Input id="accent-color" type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-14 p-1" disabled={isLoadingCompany} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveChanges} disabled={isLoadingCompany}>
                {isLoadingCompany ? 'Carregando...' : 'Salvar Alterações'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Entregas e Frete</CardTitle>
                  <CardDescription>
                    Configure suas taxas e áreas de entrega.
                  </CardDescription>
                </div>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-4 w-4" />
                  Adicionar Bairro
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bairro</TableHead>
                    <TableHead>
                      <DollarSign className="inline-block h-4 w-4 mr-1" />
                      Taxa
                    </TableHead>
                    <TableHead>
                      <Clock className="inline-block h-4 w-4 mr-1" />
                      Tempo
                    </TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryZones.map((zone) => (
                    <TableRow key={zone.neighborhood}>
                      <TableCell className="font-medium">
                        {zone.neighborhood}
                      </TableCell>
                      <TableCell>{zone.fee}</TableCell>
                      <TableCell>{zone.time}</TableCell>
                      <TableCell>
                        <Switch checked={zone.active} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens do WhatsApp</CardTitle>
              <CardDescription>
                Personalize as mensagens automáticas enviadas aos clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msg-received">Pedido Recebido</Label>
                <Textarea
                  id="msg-received"
                  defaultValue="Olá {cliente}, seu pedido nº {pedido_id} foi recebido e já estamos preparando tudo! 🍔"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-delivery">Saiu para Entrega</Label>
                <Textarea
                  id="msg-delivery"
                  defaultValue="Boas notícias, {cliente}! Seu pedido nº {pedido_id} acabou de sair para entrega e logo chegará até você! 🛵"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg-ready">Pronto para Retirada</Label>
                <Textarea
                  id="msg-ready"
                  defaultValue="Ei, {cliente}! Seu pedido nº {pedido_id} está prontinho te esperando para retirada. 😊"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Salvar Mensagens</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pagamento</CardTitle>
              <CardDescription>
                Ative os métodos de pagamento que sua loja aceita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-cash" className="flex-grow">
                  Dinheiro
                </Label>
                <Switch id="payment-cash" defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-pix" className="flex-grow">
                  PIX
                </Label>
                <Switch id="payment-pix" defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-credit" className="flex-grow">
                  Cartão de Crédito
                </Label>
                <Switch id="payment-credit" defaultChecked />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="payment-debit" className="flex-grow">
                  Cartão de Débito
                </Label>
                <Switch id="payment-debit" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
