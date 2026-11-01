import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { fetchBranches, fetchCategories, getSelectedBranchId } from '@/lib/store-api';
import { SERVICE_LINKS, SITE } from '@/lib/site';
import { AccountLink } from './account-link';
import { CartLink } from '@/components/shop/cart-link';
import { BranchSelector } from './branch-selector';
import { Container } from './container';
import { Logo } from './logo';

function SearchBox() {
  return (
    <form action="/productos" role="search" className="flex min-w-0 flex-1">
      <label htmlFor="site-search" className="sr-only">
        Buscar productos
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Buscar productos"
        className="h-11 w-full min-w-0 rounded-l-lg border border-r-0 border-slate-300 bg-white px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
      />
      <button
        type="submit"
        aria-label="Buscar"
        className="flex h-11 w-12 shrink-0 items-center justify-center rounded-r-lg bg-brand text-white transition hover:bg-brand-dark"
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}

export async function StoreHeader() {
  const [categories, branches, selectedBranchId] = await Promise.all([
    fetchCategories(),
    fetchBranches(),
    getSelectedBranchId(),
  ]);

  return (
    <header className="bg-white shadow-sm">
      <div className="hidden bg-slate-100 text-xs text-slate-600 md:block">
        <Container className="flex h-9 items-center justify-between">
          <ul className="flex gap-6">
            {SERVICE_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-brand">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            Atención: {SITE.phone} · {SITE.hours}
          </p>
        </Container>
      </div>

      <Container className="space-y-2 py-3">
        <div className="flex items-center gap-3 md:gap-6">
          <Logo />
          <div className="hidden w-56 md:block">
            <BranchSelector branches={branches} selectedId={selectedBranchId} />
          </div>
          <SearchBox />
          <AccountLink />
          <CartLink />
        </div>
        <div className="md:hidden">
          <BranchSelector branches={branches} selectedId={selectedBranchId} />
        </div>
      </Container>

      <nav aria-label="Secciones" className="border-t">
        <Container>
          <ul className="flex gap-6 overflow-x-auto py-3 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories
              .filter((category) => category.productCount > 0)
              .map((category) => (
                <li key={category.id} className="shrink-0">
                  <Link href={`/productos?category=${category.slug}`} className="hover:text-brand">
                    {category.name}
                  </Link>
                </li>
              ))}
            <li className="shrink-0">
              <Link href="/productos?onSale=true" className="font-bold text-sale">
                Ofertas
              </Link>
            </li>
            <li className="ml-auto shrink-0">
              <Link href="/cuenta/registro?tipo=comercio" className="font-semibold text-brand">
                Comprá como comercio
              </Link>
            </li>
          </ul>
        </Container>
      </nav>
    </header>
  );
}

/** Marco de la cabecera mientras llegan las categorías y sucursales. */
export function StoreHeaderSkeleton() {
  return (
    <header className="bg-white shadow-sm">
      <Container className="flex items-center gap-3 py-3 md:gap-6">
        <Logo />
        <div className="h-11 flex-1 animate-pulse rounded-lg bg-slate-100" />
      </Container>
      <div className="h-11 border-t" />
    </header>
  );
}
