'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Store, Loader2, UtensilsCrossed, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeCompanySearch, type DirectoryCompany } from '@/lib/company-directory';
import { resolveLogoUrl } from '@/lib/logo-url';
import { logoAdjustmentStyle } from '@/lib/logo-adjustments';

function CompanyCard({ company }: { company: DirectoryCompany }) {
  const [failedLogo, setFailedLogo] = useState(false);
  return (
    <Link href={`/menu/${encodeURIComponent(company.id)}`} className="group flex items-center gap-5 rounded-2xl border bg-background p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
        {company.logoUrl && !failedLogo ? (
          <img src={resolveLogoUrl(company.logoUrl)} alt={`Logo de ${company.name}`} loading="lazy" className="h-full w-full object-contain p-2" style={logoAdjustmentStyle(company.logoAdjustments)} onError={() => setFailedLogo(true)} />
        ) : <Store className="h-9 w-9 text-primary/70" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-lg font-semibold text-foreground">{company.name}</h2>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">Ver cardápio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
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
    fetch('/api/companies', { signal: controller.signal })
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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="DeliveryHub, início" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-14 w-16 object-contain" />
            <span className="text-lg font-bold tracking-tight sm:text-xl">Delivery<span className="text-primary">Hub</span></span>
          </Link>
          <Button asChild variant="outline" size="sm"><Link href="/login"><Store className="mr-2 hidden h-4 w-4 sm:block" />Acesso da empresa</Link></Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        <section className="mx-auto max-w-2xl py-12 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"><UtensilsCrossed className="h-4 w-4" />Seu próximo pedido começa aqui</span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">Encontre sua empresa<br className="hidden sm:block" /> e escolha seu pedido</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">Explore os cardápios e peça direto na empresa que você procura.</p>
          <div className="relative mt-8 text-left">
            <label htmlFor="company-search" className="sr-only">Buscar empresa pelo nome</label>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="company-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Qual empresa você está procurando?" type="search" className="h-14 rounded-xl bg-background pl-12 pr-12 text-base shadow-sm" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
          </div>
        </section>

        <section aria-labelledby="companies-heading" aria-busy={isLoading}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="companies-heading" className="text-xl font-semibold">{search.trim() ? 'Resultado da busca' : 'Conheça as empresas'}</h2>
            {!isLoading && !error && <p aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}</p>}
          </div>
          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border bg-background p-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Carregando empresas...</div>
          ) : error ? (
            <div role="alert" className="rounded-2xl border bg-background p-10 text-center"><p className="font-medium">Não foi possível carregar as empresas agora.</p><p className="mt-2 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p><Button className="mt-5" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border bg-background p-12 text-center"><Store className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><p className="font-medium">{search.trim() ? 'Nenhuma empresa encontrada com esse nome.' : 'Em breve, empresas disponíveis por aqui.'}</p><p className="mt-2 text-sm text-muted-foreground">{search.trim() ? 'Experimente buscar por outro nome.' : 'Volte mais tarde para conhecer os cardápios.'}</p>{search && <Button variant="outline" className="mt-5" onClick={() => setSearch('')}>Ver todas as empresas</Button>}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map(company => <CompanyCard key={company.id} company={company} />)}</div>
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
