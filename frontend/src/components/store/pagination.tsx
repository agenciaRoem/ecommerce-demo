import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { CatalogFilters } from '@/lib/catalog-types';
import { listingHref } from '@/lib/listing';
import { cn } from '@/lib/utils';

const WINDOW = 2;

/** Páginas a mostrar: primera, última y las vecinas de la actual (con "…" donde se omiten). */
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set([1, total, ...Array.from({ length: WINDOW * 2 + 1 }, (_, i) => current - WINDOW + i)]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1] > 1 ? ['gap' as const, n] : [n]));
}

const baseStyle = 'flex size-10 items-center justify-center rounded-lg text-sm font-medium transition';

export function Pagination({ filters, page, totalPages }: { filters: CatalogFilters; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => listingHref(filters, { page: n });

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="Página anterior" className={cn(baseStyle, 'bg-white ring-1 ring-black/10 hover:bg-brand-soft')}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : null}
      {pageNumbers(page, totalPages).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(baseStyle, n === page ? 'bg-brand text-white' : 'bg-white ring-1 ring-black/10 hover:bg-brand-soft')}
          >
            {n}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={href(page + 1)} aria-label="Página siguiente" className={cn(baseStyle, 'bg-white ring-1 ring-black/10 hover:bg-brand-soft')}>
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
