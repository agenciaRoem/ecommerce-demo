import { CheckIcon } from 'lucide-react';
import Link from 'next/link';
import type { CatalogCategory, CatalogFilters, SortOption } from '@/lib/catalog-types';
import { SORT_LABELS, listingHref } from '@/lib/listing';
import { cn } from '@/lib/utils';

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-brand-soft',
        active && 'bg-brand-soft font-semibold text-brand',
      )}
    >
      <span className="truncate">{children}</span>
      {active && <CheckIcon className="size-4 shrink-0" aria-hidden />}
    </Link>
  );
}

interface FiltersProps {
  filters: CatalogFilters;
  categories: CatalogCategory[];
}

function FilterGroups({ filters, categories, idPrefix }: FiltersProps & { idPrefix: string }) {
  const sorts = Object.keys(SORT_LABELS) as SortOption[];
  const headingClass = 'px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="space-y-5 px-2 pb-4">
      <section aria-labelledby={`${idPrefix}-cat`}>
        <h2 id={`${idPrefix}-cat`} className={headingClass}>
          Categoría
        </h2>
        <FilterLink href={listingHref(filters, { category: undefined })} active={!filters.category}>
          Todas
        </FilterLink>
        {categories
          .filter((category) => category.productCount > 0)
          .map((category) => (
            <FilterLink key={category.id} href={listingHref(filters, { category: category.slug })} active={filters.category === category.slug}>
              {category.name} <span className="text-xs text-muted-foreground">({category.productCount})</span>
            </FilterLink>
          ))}
      </section>

      <section aria-labelledby={`${idPrefix}-show`}>
        <h2 id={`${idPrefix}-show`} className={headingClass}>
          Mostrar
        </h2>
        <FilterLink href={listingHref(filters, { onSale: filters.onSale ? undefined : true })} active={!!filters.onSale}>
          Solo ofertas
        </FilterLink>
        <FilterLink href={listingHref(filters, { inStock: filters.inStock ? undefined : true })} active={!!filters.inStock}>
          Solo con stock
        </FilterLink>
      </section>

      <section aria-labelledby={`${idPrefix}-sort`}>
        <h2 id={`${idPrefix}-sort`} className={headingClass}>
          Ordenar por
        </h2>
        {sorts.map((sort) => (
          <FilterLink key={sort} href={listingHref(filters, { sort })} active={(filters.sort ?? 'newest') === sort}>
            {SORT_LABELS[sort]}
          </FilterLink>
        ))}
      </section>
    </div>
  );
}

/**
 * Filtros por enlaces: funcionan sin JavaScript y cada combinación tiene su propia URL compartible.
 * En celular son un acordeón; en pantallas grandes, un panel fijo. Son dos vistas del mismo contenido
 * porque un `<details>` cerrado oculta sus hijos aunque el CSS los muestre.
 */
export function ProductFilters(props: FiltersProps) {
  return (
    <>
      <details className="rounded-xl bg-white ring-1 ring-black/5 md:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold">Filtros</summary>
        <FilterGroups {...props} idPrefix="m" />
      </details>
      <div className="hidden rounded-xl bg-white pt-3 ring-1 ring-black/5 md:block">
        <p className="px-4 pb-2 text-sm font-bold">Filtros</p>
        <FilterGroups {...props} idPrefix="d" />
      </div>
    </>
  );
}
