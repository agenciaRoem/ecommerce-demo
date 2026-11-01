'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Page } from '../api-types';
import { queryString } from '../branch-scope';

/** Contratos de precios y costos (`/backoffice/prices`). */

export interface PriceRow {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  category: { id: string; name: string };
  cost: string;
  retailPrice: string;
  wholesalePrice: string;
  retailMarginPercent: string | null;
  wholesaleMarginPercent: string | null;
  updatedAt: string;
}

export interface PriceUpdate {
  cost?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  note?: string;
}

export interface PriceHistoryEntry {
  id: string;
  at: string;
  by: string | null;
  note: string | null;
  cost: { from: string; to: string };
  retailPrice: { from: string; to: string };
  wholesalePrice: { from: string; to: string };
}

export type Rounding = 'NONE' | 'UNIT' | 'TEN' | 'HUNDRED';

export type BulkTarget = { scope: 'ALL' } | { scope: 'CATEGORY'; categoryId: string } | { scope: 'PRODUCTS'; productIds: string[] };

export type BulkChange =
  | { mode: 'MARGIN'; retailMarginPercent?: number; wholesaleMarginPercent?: number }
  | { mode: 'ADJUST_PRICES'; percent: number; applyTo: 'RETAIL' | 'WHOLESALE' | 'BOTH' }
  | { mode: 'ADJUST_COST'; percent: number };

export interface BulkRequest {
  target: BulkTarget;
  change: BulkChange;
  rounding: Rounding;
  note?: string;
}

export type PriceProblem = 'BELOW_COST' | 'WHOLESALE_ABOVE_RETAIL' | 'TOO_LARGE';

interface Snapshot {
  cost: string;
  retailPrice: string;
  wholesalePrice: string;
}

export interface BulkPreview {
  matched: number;
  changed: number;
  unchanged: number;
  invalid: number;
  problems: Partial<Record<PriceProblem, number>>;
  canApply: boolean;
  sample: { id: string; sku: string; name: string; before: Snapshot; after: Snapshot; problem: string | null }[];
}

export const PROBLEM_LABEL: Record<PriceProblem, string> = {
  BELOW_COST: 'quedarían por debajo del costo',
  WHOLESALE_ABOVE_RETAIL: 'tendrían el mayorista por encima del minorista',
  TOO_LARGE: 'tendrían un importe demasiado grande',
};

export interface PriceFilters {
  search: string;
  categoryId: string;
  includeInactive: boolean;
  page: number;
}

export function usePrices(filters: PriceFilters) {
  return useQuery({
    queryKey: ['backoffice', 'prices', filters],
    queryFn: () =>
      api<Page<PriceRow>>(
        `/backoffice/prices${queryString({ search: filters.search, categoryId: filters.categoryId, includeInactive: filters.includeInactive || undefined, page: filters.page, limit: 25 })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function usePriceHistory(productId: string | null) {
  return useQuery({
    queryKey: ['backoffice', 'price-history', productId],
    queryFn: () => api<PriceHistoryEntry[]>(`/backoffice/prices/${productId}/history`),
    enabled: productId !== null,
  });
}

/** Después de cambiar precios se renueva todo lo que los muestra (la lista, el historial y los márgenes del resumen). */
function useRefreshPrices() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['backoffice', 'prices'] });
    void queryClient.invalidateQueries({ queryKey: ['backoffice', 'price-history'] });
    void queryClient.invalidateQueries({ queryKey: ['backoffice', 'overview'] });
  };
}

export function useUpdatePrice() {
  const refresh = useRefreshPrices();
  return useMutation({
    mutationFn: ({ id, ...body }: PriceUpdate & { id: string }) => api<PriceRow>(`/backoffice/prices/${id}`, { method: 'PATCH', json: body }),
    onSuccess: refresh,
  });
}

export function useBulkPreview() {
  return useMutation({
    mutationFn: (request: BulkRequest) => api<BulkPreview>('/backoffice/prices/bulk/preview', { method: 'POST', json: request }),
  });
}

export function useBulkApply() {
  const refresh = useRefreshPrices();
  return useMutation({
    mutationFn: (request: BulkRequest) => api<{ changed: number }>('/backoffice/prices/bulk/apply', { method: 'POST', json: request }),
    onSuccess: refresh,
  });
}
