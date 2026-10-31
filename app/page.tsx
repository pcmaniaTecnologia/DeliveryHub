'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, Store, Loader2, UtensilsCrossed, X, ShoppingBag, Sparkles, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeCompanySearch, type DirectoryCompany } from '@/lib/company-directory';
import { resolveLogoUrl } from '@/lib/logo-url';
import { logoAdjustmentStyle } from '@/lib/logo-adjustments';

function CompanyCard({ company }: { company: DirectoryCompany }) {
  const [failedLogo, setFailedLogo] = useState(false);

  return (
    <Link
      href={`/menu/${encodeURIComponent(company.id)}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.65rem] border border-slate-200/80 bg-white shadow-[0_6px_24px_-16px_rgba(15,23,42,.28)] transition duration-300 hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_20px_40px_-22px_rgba(13,148,136,.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#e8f5f1_0%,#f5f2e9_52%,#f7e9d9_100%)]">
        <div aria-hidden="true" className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/70" />
        <div aria-hidden="true" className="absolute -bottom-20 -left-8 h-44 w-44 rounded-full border border-white/70" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-slate-600 shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Cardápio digital
        </span>
        <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-[1.65rem] border border-white/90 bg-white shadow-[0_15px_35px_-16px_rgba(15,23,42,.4)] transition duration-300 group-hover:scale-[1.04]">
          {company.logoUrl && !failedLogo ? (
            <img
              src={resolveLogoUrl(company.logoUrl)}
              alt={`Logo de ${company.name}`}
              loading="lazy"
              className="h-full w-full object-contain p-2.5"
              style={logoAdjustmentStyle(company.logoAdjustments)}
              onError={() => setFailedLogo(true)}
            />
          ) : (
            <Store className="h-9 w-9 text-teal-700/70" aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <h3 className="break-words text-xl font-bold tracking-tight text-slate-900">{company.name}</h3>
        <p className="mb-6 mt-2 text-sm leading-6 text-slate-500">Conheça o cardápio e faça seu pedido diretamente com a loja.</p>
        <span className="mt-auto inline-flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors group-hover:bg-teal-700 group-hover:text-white">
          Ver cardápio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function CompanyCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[1.65rem] border border-slate-200 bg-white">
      <div className="h-44 animate-pulse bg-slate-100" />
      <div className="space-y-3 p-6">
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f6] text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute -left-48 top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-100/50 blur-3xl" />
      <header className="relative z-10 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Link href="/" aria-label="DeliveryHub, início" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
            <img src="/logo.png" alt="" className="h-12 w-14 object-contain" />
            <span className="text-lg font-extrabold tracking-tight sm:text-xl">Delivery<span className="text-teal-700">Hub</span></span>
          </Link>
          <Button asChild variant="outline" className="h-10 rounded-full border-slate-300 px-4 text-slate-700 hover:border-teal-600 hover:text-teal-800">
            <Link href="/login"><Store className="mr-2 h-4 w-4" />Acesso da empresa</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-7xl flex-1 px-4 pb-16 sm:px-8">
        <section className="relative my-6 overflow-hidden rounded-[2rem] bg-[#102e2b] text-white shadow-[0_28px_70px_-36px_rgba(15,46,43,.65)] sm:my-9 sm:rounded-[2.5rem]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 h-[28rem] w-[28rem] rounded-full bg-teal-400/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 left-1/3 h-[26rem] w-[26rem] rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative grid items-center gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.2fr_.8fr] lg:gap-14 lg:px-16 lg:py-[4.5rem]">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.16em] text-teal-100">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Descubra algo gostoso hoje
              </span>
              <h1 className="mt-6 text-[2.65rem] font-semibold leading-[1.06] tracking-[-.045em] sm:text-6xl lg:text-[4.4rem]">
                Seu próximo favorito está <span className="text-[#c7e8d7]">mais perto.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-teal-50/75 sm:text-lg sm:leading-8">
                Encontre lojas, explore cardápios e peça direto de quem prepara — tudo em um só lugar.
              </p>

              <div className="relative mt-8 max-w-xl rounded-2xl bg-white p-1.5 shadow-[0_20px_55px_-28px_rgba(0,0,0,.65)] sm:mt-9">
                <label htmlFor="company-search" className="sr-only">Buscar empresa pelo nome</label>
                <Search className="absolute left-5 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="company-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Qual loja você quer conhecer?"
                  type="search"
                  className="h-14 rounded-xl border-0 bg-white pl-12 pr-12 text-base text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-teal-600"
                />
                {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>}
              </div>

              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-teal-50/75 sm:text-sm">
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-300" />Lojas da sua região</span>
                <span className="inline-flex items-center gap-2"><UtensilsCrossed className="h-4 w-4 text-amber-300" />Cardápios digitais</span>
                <span className="inline-flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-amber-300" />Pedido direto com a loja</span>
              </div>
            </div>

            <div aria-hidden="true" className="relative mx-auto hidden h-[21rem] w-full max-w-[25rem] items-center justify-center lg:flex">
              <div className="absolute h-[18rem] w-[18rem] rounded-full border border-white/10" />
              <div className="absolute h-[14rem] w-[14rem] rounded-full border border-white/10" />
              <div className="absolute right-7 top-8 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-amber-200 shadow-lg backdrop-blur"><ShoppingBag className="h-6 w-6" /></div>
              <div className="absolute bottom-9 left-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-teal-100 shadow-lg backdrop-blur"><UtensilsCrossed className="h-5 w-5" /></div>
              <div className="relative w-[19rem] rotate-[-4deg] rounded-[1.8rem] border border-white/20 bg-white/[.09] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,.65)] backdrop-blur-xl">
                <div className="rounded-[1.3rem] bg-[#f8f7f0] p-5 text-slate-900">
                  <div className="flex items-center justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d8eee3] text-teal-800"><Store className="h-5 w-5" /></div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">Perto de você</span>
                  </div>
                  <div className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-teal-700">Uma boa descoberta</div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">Sabores locais</div>
                  <div className="mt-2 text-sm text-slate-500">Lojas independentes, prontas para surpreender.</div>
                  <div className="mt-5 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-xs font-semibold text-slate-700">Explore os cardápios</span>
                    <ChevronRight className="h-4 w-4 text-teal-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="companies-heading" aria-busy={isLoading} className="pt-4 sm:pt-7">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
            <div>
              <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-teal-800"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-100"><ShoppingBag className="h-3.5 w-3.5" /></span> A vitrine</p>
              <h2 id="companies-heading" className="text-2xl font-bold tracking-[-.035em] text-slate-900 sm:text-4xl">{search.trim() ? 'Lojas para sua busca' : 'Conheça os destaques'}</h2>
              <p className="mt-2 text-sm text-slate-500 sm:text-base">Escolha uma loja e descubra tudo o que ela preparou.</p>
            </div>
            {!isLoading && !error && <p aria-live="polite" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm">{filtered.length} {filtered.length === 1 ? 'loja disponível' : 'lojas disponíveis'}</p>}
          </div>

          {isLoading ? (
            <div role="status" aria-label="Carregando empresas" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><CompanyCardSkeleton /><CompanyCardSkeleton /><CompanyCardSkeleton /></div>
          ) : error ? (
            <div role="alert" className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:py-16"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Store className="h-6 w-6" /></div><p className="mt-5 font-semibold text-slate-900">Não foi possível carregar as lojas agora.</p><p className="mt-2 text-sm text-slate-500">Tente novamente em alguns instantes.</p><Button className="mt-6 rounded-full bg-teal-800 px-5 hover:bg-teal-900" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:py-16"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Search className="h-6 w-6" /></div><p className="mt-5 font-semibold text-slate-900">{search.trim() ? 'Não encontramos essa loja.' : 'Novas lojas em breve.'}</p><p className="mt-2 text-sm text-slate-500">{search.trim() ? 'Tente outro nome ou veja todas as lojas disponíveis.' : 'Volte em breve para conhecer novos cardápios.'}</p>{search && <Button variant="outline" className="mt-6 rounded-full" onClick={() => setSearch('')}>Ver todas as lojas</Button>}</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(company => <CompanyCard key={company.id} company={company} />)}</div>
          )}
        </section>
      </main>

      <footer className="relative z-[1] mt-8 border-t border-slate-200 bg-white/80 px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>Feito com cuidado por <a href="https://www.pcmania.net" target="_blank" rel="noopener noreferrer" className="font-bold text-teal-800 hover:underline">PC MANIA</a></p>
          <Link href="/signup" className="inline-flex items-center gap-1 font-semibold text-slate-700 transition hover:text-teal-800">Sua empresa merece uma vitrine <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </footer>
    </div>
  );
}
