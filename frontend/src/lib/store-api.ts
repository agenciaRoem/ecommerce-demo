import 'server-only';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BRANCH_COOKIE } from './branch-cookie';
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogPage,
  CatalogProductDetail,
  StoreBranch,
} from './catalog-types';

/** En Docker el servidor de Next llega a la API por la red interna; el navegador, por la URL pública. */
const API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const CUSTOMER_ACCESS_COOKIE = 'customer_access_token';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consulta la API desde el servidor reenviando la sesión del cliente (si la hay) para que los precios
 * sean los suyos. Nunca se cachea: el stock y los precios deben ser los del momento.
 */
async function storeFetch<T>(path: string): Promise<T> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_ACCESS_COOKIE)?.value;

  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: token ? { Cookie: `${CUSTOMER_ACCESS_COOKIE}=${token}` } : undefined,
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`La API respondió ${res.status} en ${path}`);
  return (await res.json()) as T;
}

/** Sucursal elegida por el visitante para retirar (cookie no sensible). */
export async function getSelectedBranchId(): Promise<string | undefined> {
  const value = (await cookies()).get(BRANCH_COOKIE)?.value;
  return value && UUID.test(value) ? value : undefined;
}

/** Datos básicos para metadatos (SEO): no depende de la sesión, así que no usa cookies. */
export async function fetchProductSummary(id: string): Promise<CatalogProductDetail | null> {
  if (!UUID.test(id)) return null;
  const res = await fetch(`${API_BASE}/catalog/products/${id}`, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as CatalogProductDetail) : null;
}

export const fetchBranches = () => storeFetch<StoreBranch[]>('/catalog/branches');
export const fetchCategories = () => storeFetch<CatalogCategory[]>('/catalog/categories');

export async function fetchProducts(filters: CatalogFilters = {}): Promise<CatalogPage> {
  const branchId = await getSelectedBranchId();
  const params = new URLSearchParams();
  if (filters.q) params.set('search', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.onSale) params.set('onSale', 'true');
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (branchId) params.set('branchId', branchId);
  return storeFetch<CatalogPage>(`/catalog/products?${params}`);
}

export async function fetchProduct(id: string): Promise<CatalogProductDetail> {
  if (!UUID.test(id)) notFound();
  return storeFetch<CatalogProductDetail>(`/catalog/products/${id}`);
}
