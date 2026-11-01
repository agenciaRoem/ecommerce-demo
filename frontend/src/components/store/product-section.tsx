import Link from 'next/link';
import type { CatalogFilters } from '@/lib/catalog-types';
import { fetchBranches, fetchProducts, getSelectedBranchId } from '@/lib/store-api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselItem } from './carousel';
import { ProductCard } from './product-card';

interface ProductSectionProps {
  title: string;
  filters: CatalogFilters;
  /** "Ver todos" lleva al listado con los mismos filtros. */
  href: string;
  /** `brand`: bloque de color como el de "Ofertas". */
  tone?: 'plain' | 'brand';
}

/** Título + carrusel de productos. Si no hay resultados no renderiza nada. */
export async function ProductSection({ title, filters, href, tone = 'plain' }: ProductSectionProps) {
  const [{ items }, branchId, branches] = await Promise.all([
    fetchProducts({ limit: 10, ...filters }),
    getSelectedBranchId(),
    fetchBranches(),
  ]);
  if (items.length === 0) return null;
  const branchName = branches.find((b) => b.id === branchId)?.name;
  const brand = tone === 'brand';

  return (
    <section
      aria-label={title}
      className={cn('space-y-4', brand && 'rounded-2xl bg-brand-dark p-4 md:p-6')}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className={cn('text-xl font-bold tracking-tight md:text-2xl', brand && 'text-white')}>{title}</h2>
        <Link
          href={href}
          className={cn('shrink-0 text-sm font-semibold underline-offset-4 hover:underline', brand ? 'text-white' : 'text-brand')}
        >
          Ver todos
        </Link>
      </div>
      <Carousel label={title}>
        {items.map((product) => (
          <CarouselItem key={product.id}>
            <ProductCard product={product} branchName={branchName} />
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}

export function ProductSectionSkeleton({ tone = 'plain' }: { tone?: 'plain' | 'brand' }) {
  return (
    <div className={cn('space-y-4', tone === 'brand' && 'rounded-2xl bg-brand-dark p-4 md:p-6')}>
      <Skeleton className="h-7 w-72 max-w-full" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-72 w-[46%] shrink-0 sm:w-[31%] md:w-[23.5%] lg:w-[19%]" />
        ))}
      </div>
    </div>
  );
}
