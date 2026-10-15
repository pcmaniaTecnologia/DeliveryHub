'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Store, Loader2, UtensilsCrossed, X, ShoppingBag, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeCompanySearch, type DirectoryCompany } from '@/lib/company-directory';
import { resolveLogoUrl } from '@/lib/logo-url';
import { logoAdjustmentStyle } from '@/lib/logo-adjustments';

function CompanyCard({ company }: { company: DirectoryCompany }) {
  const [failedLogo, setFailedLogo] = useState(false);
  return (
    <Link href={`/menu/${encodeURIComponent(company.id)}`} className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-primary/10 bg-background shadow-sm transition duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:hover:-translate-y-1">
      <div className="relative flex h-40 items-center justify-center bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.18),transparent_70%)] bg-muted/40">
        <span className="absolute left-4 top-4 rounded-full border bg-background/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Cardápio digital</span>
      <div className="mt-5 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border bg-background shadow-lg shadow-primary/10 transition duration-300 motion-safe:group-hover:scale-105">
        {company.logoUrl && !failedLogo ? (
          <img src={resolveLogoUrl(company.logoUrl)} alt={`Logo de ${company.name}`} loading="lazy" className="h-full w-full object-contain p-2" style={logoAdjustmentStyle(company.logoAdjustments)} onError={() => setFailedLogo(true)} />
        ) : <Store className="h-9 w-9 text-primary/70" aria-hidden="true" />}
      </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <h3 className="break-words text-xl font-bold tracking-tight text-foreground">{company.name}</h3>
        <p className="mb-6 mt-2 text-sm text-muted-foreground">Explore o cardápio e escolha seu próximo pedido.</p>
        <span className="mt-auto inline-flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">Explorar cardápio <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [companies, setCompanies] = useState<DirectoryCompany[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(false);
    fetch('/api/companies', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Directory unavailable');
        const data = await response.json();
        if (!Array.isArray(data.companies)) throw new Error('Invalid directory');
        setCompanies(data.companies);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const filtered = useMemo(() => {
    const term = normalizeCompanySearch(search);
    return companies.filter(company => normalizeCompanySearch(company.name).includes(term));
  }, [companies, search]);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.07),transparent_50%)] bg-muted/20">
      <header className="border-b border-primary/10 bg-background/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="DeliveryHub, início" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-14 w-16 object-contain" />
            <span className="text-lg font-bold tracking-tight sm:text-xl">Delivery<span className="text-primary">Hub</span></span>
          </Link>
          <Button asChild variant="outline" size="sm"><Link href="/login"><Store className="mr-2 hidden h-4 w-4 sm:block" />Acesso da empresa</Link></Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <section className="relative my-6 overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-10 text-center text-white sm:my-8 sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Seu próximo pedido<br /><span className="text-orange-300">começa aqui.</span></h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">Encontre seus lugares favoritos, explore os cardápios e peça direto com quem prepara.</p>
          <div className="relative mt-8 text-left text-foreground">
            <label htmlFor="company-search" className="sr-only">Buscar empresa pelo nome</label>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="company-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Busque sua empresa favorita" type="search" className="h-16 rounded-2xl border-white/20 bg-background pl-12 pr-12 text-base shadow-xl focus-visible:ring-orange-300" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-slate-300 sm:text-sm">
            <span className="inline-flex items-center gap-2"><Store className="h-4 w-4 text-orange-300" />Empresas da sua região</span>
            <span className="inline-flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-orange-300" />Cardápios em um só lugar</span>
            <span className="inline-flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-orange-300" />Pedido direto na empresa</span>
          </div>
          </div>
        </section>

        <section aria-labelledby="companies-heading" aria-busy={isLoading}>
          <div className="mb-6 mt-10 flex flex-wrap items-end justify-between gap-3">
            <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"><ShoppingBag className="h-4 w-4" />Vitrine DeliveryHub</p><h2 id="companies-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">{search.trim() ? 'O que você procura está aqui' : 'Conheça seu próximo favorito'}</h2><p className="mt-2 text-sm text-muted-foreground">Escolha uma empresa e descubra o que tem no cardápio.</p></div>
            {!isLoading && !error && <p aria-live="polite" className="rounded-full border bg-background px-4 py-2 text-xs font-medium text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}</p>}
          </div>
          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border bg-background p-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando empresas...</div>
          ) : error ? (
            <div role="alert" className="rounded-2xl border bg-background p-10 text-center"><p className="font-medium">Não foi possível carregar as empresas agora.</p><p className="mt-2 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p><Button className="mt-5" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border bg-background p-12 text-center"><Store className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><p className="font-medium">{search.trim() ? 'Nenhuma empresa encontrada com esse nome.' : 'Em breve, empresas disponíveis por aqui.'}</p><p className="mt-2 text-sm text-muted-foreground">{search.trim() ? 'Experimente buscar por outro nome.' : 'Volte mais tarde para conhecer os cardápios.'}</p>{search && <Button variant="outline" className="mt-5" onClick={() => setSearch('')}>Ver todas as empresas</Button>}</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(company => <CompanyCard key={company.id} company={company} />)}</div>
          )}
        </section>
      </main>

      <footer className="border-t bg-background px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <p>Criado por <a href="https://www.pcmania.net" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">PC MANIA</a></p>
          <Link href="/signup" className="hover:text-primary hover:underline">Cadastre sua empresa no DeliveryHub <span aria-hidden="true">→</span></Link>
        </div>
      </footer>
    </div>
  );
}
