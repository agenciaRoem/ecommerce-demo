import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Container } from '@/components/store/container';
import { Pagination } from '@/components/store/pagination';
import { ProductCard } from '@/components/store/product-card';
import { ProductFilters } from '@/components/store/product-filters';
import { Skeleton } from '@/components/ui/skeleton';
import { PAGE_SIZE, parseListingParams } from '@/lib/listing';
import { fetchBranches, fetchCategories, fetchProducts, getSelectedBranchId } from '@/lib/store-api';

export const metadata: Metadata = { title: 'Productos' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="py-6">
      <Suspense fallback={<ListingSkeleton />}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Listing({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseListingParams(await searchParams);
  const [result, categories, branches, branchId] = await Promise.all([
    fetchProducts({ ...filters, limit: PAGE_SIZE }),
    fetchCategories(),
    fetchBranches(),
    getSelectedBranchId(),
  ]);

  const branchName = branches.find((b) => b.id === branchId)?.name;
  const category = categories.find((c) => c.slug === filters.category);
  const title = filters.q
    ? `Resultados para “${filters.q}”`
    : filters.onSale
      ? 'Ofertas'
      : (category?.name ?? 'Todos los productos');
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Filtros">
        <ProductFilters filters={filters} categories={categories} />
      </aside>

      <section className="min-w-0 space-y-5" aria-labelledby="listing-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 id="listing-title" className="text-2xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {result.total} {result.total === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {result.items.length === 0 ? (
          <div className="space-y-3 rounded-xl bg-white p-8 text-center ring-1 ring-black/5">
            <p className="font-semibold">No encontramos productos con esos filtros.</p>
            <Link href="/productos" className="text-sm font-semibold text-brand underline underline-offset-4">
              Ver todos los productos
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} branchName={branchName} />
              </li>
            ))}
          </ul>
        )}

        <Pagination filters={filters} page={result.page} totalPages={totalPages} />
      </section>
    </div>
  );
}

function ListingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <Skeleton className="h-96" />
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    </div>
  );
}
