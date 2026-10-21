'use client';

import { useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Printer, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { groupFinalizedComandas, generateFinalizedComandaHtml, type FinalizedOrder, type FinalizedComanda } from '@/lib/finalized-comandas';
import { printHtml } from '@/lib/print-utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function FinalizedComandasDialog({ companyId, companyName }: { companyId?: string | null; companyName: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(today);
    const [to, setTo] = useState(today);
    const [search, setSearch] = useState('');
    const validRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
    const ordersRef = useMemoFirebase(() => {
        if (!open || !firestore || !companyId || !validRange) return null;
        return query(collection(firestore, 'companies', companyId, 'orders'),
            where('orderDate', '>=', new Date(`${from}T00:00:00-03:00`)), where('orderDate', '<=', new Date(`${to}T23:59:59.999-03:00`)));
    }, [open, firestore, companyId, validRange, from, to]);
    const movementsRef = useMemoFirebase(() => {
        if (!open || !firestore || !companyId || !validRange) return null;
        return query(collection(firestore, 'companies', companyId, 'cashier_transactions'),
            where('timestamp', '>=', new Date(`${from}T00:00:00-03:00`)), where('timestamp', '<=', new Date(`${to}T23:59:59.999-03:00`)));
    }, [open, firestore, companyId, validRange, from, to]);
    const { data: orders, isLoading: loadingOrders, error: ordersError } = useCollection<FinalizedOrder>(ordersRef);
    const { data: movements, isLoading: loadingMovements, error: movementsError } = useCollection<any>(movementsRef);
    const receipts = useMemo(() => groupFinalizedComandas(orders || [], movements || []), [orders, movements]);
    const filtered = receipts.filter(receipt => {
        const query = search.toLocaleLowerCase('pt-BR').trim();
        return !query || `mesa ${receipt.tableNumber} ${receipt.orders.map(o => `${o.customerName || ''} ${o.id}`).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query);
    });
    const loading = loadingOrders || loadingMovements;
    const reprint = (receipt: FinalizedComanda) => {
        try { printHtml(generateFinalizedComandaHtml(receipt, companyName)); }
        catch { toast({ variant: 'destructive', title: 'Não foi possível abrir a impressão', description: 'Tente novamente e verifique as permissões de impressão do navegador.' }); }
    };

    return <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm" className="shrink-0 gap-2" aria-label="Reimprimir Comandas" title="Reimprimir comandas finalizadas">
            <Printer className="h-4 w-4" /><span className="hidden sm:inline">Reimprimir Comandas</span>
        </Button></DialogTrigger>
        <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
            <DialogHeader><DialogTitle>Comandas finalizadas</DialogTitle><DialogDescription>Localize a comanda para emitir uma segunda via do pagamento registrado.</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label htmlFor="finalized-from">Pedidos de</Label><Input id="finalized-from" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="finalized-to">Pedidos até</Label><Input id="finalized-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></div>
                <div className="space-y-1 col-span-2 sm:col-span-1"><Label htmlFor="finalized-search">Mesa ou cliente</Label><Input id="finalized-search" placeholder="Mesa, cliente ou pedido" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
            <div className="overflow-y-auto min-h-0 flex-1 space-y-3 pr-1">
                {!validRange ? <p role="alert">Informe um período válido.</p> : loading ? <p className="flex items-center gap-2 py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando comandas...</p>
                    : ordersError || movementsError ? <p role="alert">Não foi possível carregar o histórico. Confira sua conexão e tente novamente.</p>
                    : filtered.length === 0 ? <p className="py-8 text-center text-muted-foreground">Nenhuma comanda finalizada encontrada neste período.</p>
                    : filtered.map(receipt => <div key={receipt.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3"><div><p className="font-bold">Mesa {receipt.tableNumber} <span className="text-xs font-normal text-muted-foreground">· {receipt.orders.length} {receipt.orders.length === 1 ? 'pedido' : 'pedidos'}</span></p>
                            <p className="text-sm">{[...new Set(receipt.orders.map(o => o.customerName).filter(Boolean))].join(', ') || 'Cliente na mesa'}</p></div>
                            <span className="font-bold whitespace-nowrap">{receipt.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                        <p className="text-xs text-muted-foreground">{receipt.paidAt ? 'Pagamento: ' + new Date(receipt.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Pedido: ' + (receipt.orders[0].orderDate?.toDate?.().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'Data não informada')} · {[...new Set(receipt.orders.map(o => o.paymentMethod).filter(Boolean))].join(' | ')}</p>
                        <details className="text-sm"><summary className="cursor-pointer">Ver itens e pedidos</summary><ul className="pl-4 list-disc mt-2">{receipt.orders.flatMap(o => (o.orderItems || []).map((item, idx) => <li key={`${o.id}-${idx}`}>{item.quantity}x {item.productName || item.productId}</li>))}</ul><p className="text-xs text-muted-foreground mt-2">Pedidos: {receipt.orders.map(o => o.id.slice(0,6).toUpperCase()).join(', ')}</p></details>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => reprint(receipt)} aria-label={`Reimprimir comanda da mesa ${receipt.tableNumber}`}><Printer className="h-4 w-4" /> Reimprimir</Button>
                    </div>)}
            </div>
        </DialogContent>
    </Dialog>;
}
