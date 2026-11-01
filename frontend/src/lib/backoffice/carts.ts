'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { Page } from '../api-types';
import { queryString } from '../branch-scope';

/** Carritos con productos que el cliente dejó sin comprar (`/backoffice/abandoned-carts`). */

export interface AbandonedCart {
  customer: { id: string; name: string; businessName: string | null; email: string; phone: string | null; type: 'RETAIL' | 'COMMERCE' };
  lastActivityAt: string;
  units: number;
  estimatedValue: string;
  lines: { productId: string; name: string; sku: string; quantity: number; unitPrice: string }[];
}

export function useAbandonedCarts(idleMinutes: number, page: number) {
  return useQuery({
    queryKey: ['backoffice', 'abandoned-carts', idleMinutes, page],
    queryFn: () => api<Page<AbandonedCart>>(`/backoffice/abandoned-carts${queryString({ idleMinutes, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
}
