'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Page } from '../api-types';
import { queryString } from '../branch-scope';

/** Contratos de descuentos por evento (`/backoffice/promotions`). */

export type PromotionState = 'active' | 'upcoming' | 'ended' | 'inactive';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type Audience = 'ALL' | 'RETAIL' | 'COMMERCE';
export type PromotionScope = 'ALL' | 'CATEGORY' | 'PRODUCTS';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  value: string;
  audience: Audience;
  scope: PromotionScope;
  category: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  products: { id: string; sku: string; name: string }[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: PromotionState;
}

/** Lo que se envía al guardar. `branchId: null` = todas las sucursales (solo el superadmin). */
export interface PromotionInput {
  name: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  audience: Audience;
  scope: PromotionScope;
  categoryId?: string;
  productIds?: string[];
  branchId?: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export const STATE_LABEL: Record<PromotionState, string> = {
  active: 'Vigente',
  upcoming: 'Programada',
  ended: 'Terminada',
  inactive: 'Pausada',
};

export const AUDIENCE_LABEL: Record<Audience, string> = { ALL: 'Todos los clientes', RETAIL: 'Consumidor final', COMMERCE: 'Comercios (B2B)' };

export function usePromotions(status: PromotionState | 'all', page: number) {
  return useQuery({
    queryKey: ['backoffice', 'promotions', status, page],
    queryFn: () => api<Page<Promotion>>(`/backoffice/promotions${queryString({ status, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useSavePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: PromotionInput & { id?: string }) =>
      id ? api<Promotion>(`/backoffice/promotions/${id}`, { method: 'PUT', json: input }) : api<Promotion>('/backoffice/promotions', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'promotions'] }),
  });
}
