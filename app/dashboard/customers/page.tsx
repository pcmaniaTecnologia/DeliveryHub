'use client';

import { useMemo, useState } from 'react';
import { collection, serverTimestamp } from 'firebase/firestore';
import { Search, UserPlus, Users, Pencil, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocument, updateDocument } from '@/firebase';
import { useImpersonation } from '@/context/impersonation-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Customer = { id: string; name: string; phone: string; address: string; email: string; notes?: string };
const emptyForm = { name: '', phone: '', address: '', email: '', notes: '' };

export default function CustomersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { isImpersonating, impersonatedCompanyId } = useImpersonation();
  const companyId = isImpersonating ? impersonatedCompanyId : user?.uid;
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const customersRef = useMemoFirebase(() => firestore && companyId ? collection(firestore, `companies/${companyId}/customers`) : null, [firestore, companyId]);
  const { data: customers, isLoading } = useCollection<Customer>(customersRef);
  const filtered = useMemo(() => (customers || []).filter(c => `${c.name} ${c.phone} ${c.email}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')), [customers, search]);

  const startNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (customer: Customer) => { setEditing(customer); setForm({ name: customer.name || '', phone: customer.phone || '', address: customer.address || '', email: customer.email || '', notes: customer.notes || '' }); setOpen(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!firestore || !companyId) return;
    if (form.name.trim().split(/\s+/).length < 2) { toast({ variant: 'destructive', title: 'Informe o nome completo', description: 'Para o crediário, cadastre nome e sobrenome.' }); return; }
    if (form.phone.replace(/\D/g, '').length < 10) { toast({ variant: 'destructive', title: 'Contato inválido', description: 'Informe um telefone com DDD.' }); return; }
    if (form.address.trim().length < 5) { toast({ variant: 'destructive', title: 'Endereço obrigatório', description: 'Informe o endereço completo do cliente.' }); return; }
    setSaving(true);
    try {
      const data = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), email: form.email.trim(), notes: form.notes.trim(), updatedAt: serverTimestamp() };
      if (editing) await updateDocument((await import('firebase/firestore')).doc(firestore, `companies/${companyId}/customers`, editing.id), data);
      else await addDocument(collection(firestore, `companies/${companyId}/customers`), { ...data, createdAt: serverTimestamp() });
      toast({ title: editing ? 'Cadastro atualizado' : 'Cliente cadastrado', description: `${data.name} está disponível para vendas no crediário.` });
      setOpen(false);
    } catch (error) {
      console.error('Falha ao salvar cliente:', error);
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      toast({
        variant: 'destructive',
        title: code === 'permission-denied' || code === 'firestore/permission-denied' ? 'Sem permissão para salvar' : 'Não foi possível salvar',
        description: code === 'permission-denied' || code === 'firestore/permission-denied'
          ? 'As regras do Firestore ainda não permitem o cadastro de clientes. Publique as regras atualizadas e tente novamente.'
          : code ? `Erro ${code}. Verifique a conexão e tente novamente.` : 'Verifique a conexão e tente novamente.',
      });
    }
    finally { setSaving(false); }
  };

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Cadastro para vendas no crediário</div><h1 className="text-3xl font-bold tracking-tight">Clientes</h1><p className="mt-1 text-muted-foreground">Mantenha os dados de contato e endereço para reutilizar no PDV.</p></div><Button onClick={startNew} className="gap-2"><UserPlus className="h-4 w-4" /> Cadastrar cliente</Button></div>
    <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Clientes cadastrados</CardTitle><CardDescription>{customers?.length || 0} clientes</CardDescription></CardHeader><CardContent className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando clientes...</div> : filtered.length ? <div className="divide-y rounded-lg border">{filtered.map(customer => <div key={customer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{customer.name}</p><p className="text-sm text-muted-foreground">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p><p className="mt-1 truncate text-sm text-muted-foreground">{customer.address}</p></div><Button variant="outline" size="sm" onClick={() => startEdit(customer)} className="gap-2 self-start sm:self-auto"><Pencil className="h-4 w-4"/> Editar</Button></div>)}</div> : <div className="rounded-lg border border-dashed py-12 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p><p className="mt-1 text-sm text-muted-foreground">Cadastre clientes para usar seus dados no crediário do PDV.</p></div>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><form onSubmit={save}><DialogHeader><DialogTitle>{editing ? 'Editar cliente' : 'Cadastrar cliente'}</DialogTitle><DialogDescription>Nome, contato e endereço são usados para identificar vendas no crediário.</DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-name">Nome completo *</Label><Input id="customer-name" required autoComplete="name" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Ex: Maria da Silva"/></div><div className="space-y-2"><Label htmlFor="customer-phone">Telefone / WhatsApp *</Label><Input id="customer-phone" required type="tel" autoComplete="tel" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})} placeholder="(99) 99999-9999"/></div><div className="space-y-2"><Label htmlFor="customer-email">E-mail</Label><Input id="customer-email" type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} placeholder="cliente@email.com"/></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-address">Endereço completo *</Label><Input id="customer-address" required autoComplete="street-address" value={form.address} onChange={e => setForm({...form, address:e.target.value})} placeholder="Rua, número, bairro e cidade"/></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-notes">Observações</Label><Input id="customer-notes" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Referências ou observações (opcional)"/></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin"/>}{saving ? 'Salvando...' : 'Salvar cliente'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}
