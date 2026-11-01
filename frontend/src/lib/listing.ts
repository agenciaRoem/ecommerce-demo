import { z } from 'zod';
import type { CatalogFilters, SortOption } from './catalog-types';

export const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Más nuevos',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
  name: 'Nombre (A-Z)',
};

export const PAGE_SIZE = 12;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/** Sin caracteres de control (p. ej. `%00`): la API los rechaza. */
const printable = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);

/** Valores inválidos en la URL se ignoran en vez de romper la página. */
const listingSchema = z.object({
  q: z.preprocess(first, z.string().trim().min(1).max(80).refine(printable).optional().catch(undefined)),
  category: z.preprocess(first, z.string().regex(/^[a-z0-9-]{1,60}$/).optional().catch(undefined)),
  sort: z.preprocess(first, z.enum(['newest', 'price_asc', 'price_desc', 'name']).optional().catch(undefined)),
  onSale: z.preprocess(first, z.literal('true').optional().catch(undefined)),
  inStock: z.preprocess(first, z.literal('true').optional().catch(undefined)),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(500).catch(1)),
});

export function parseListingParams(raw: Record<string, string | string[] | undefined>): CatalogFilters & { page: number } {
  const parsed = listingSchema.parse(raw);
  return {
    q: parsed.q,
    category: parsed.category,
    sort: parsed.sort,
    onSale: parsed.onSale === 'true' ? true : undefined,
    inStock: parsed.inStock === 'true' ? true : undefined,
    page: parsed.page,
  };
}

/** Arma `/productos?...` a partir de los filtros actuales, aplicando cambios (un valor `undefined` quita el filtro). */
export function listingHref(current: CatalogFilters, changes: Partial<CatalogFilters> = {}): string {
  const merged: CatalogFilters = { ...current, page: undefined, ...changes };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.category) params.set('category', merged.category);
  if (merged.sort && merged.sort !== 'newest') params.set('sort', merged.sort);
  if (merged.onSale) params.set('onSale', 'true');
  if (merged.inStock) params.set('inStock', 'true');
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));
  const query = params.toString();
  return query ? `/productos?${query}` : '/productos';
}
