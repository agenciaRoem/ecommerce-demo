'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { queryString, withBranch } from '../branch-scope';

/** Contratos de las métricas del backoffice (`/backoffice/analytics`). Los importes llegan como texto con 2 decimales. */

export interface PeriodTotals {
  orders: number;
  units: number;
  revenue: string;
  averageTicket: string;
  discounts: string;
  estimatedMargin: string;
}

export interface Slice {
  key: string;
  label: string;
  orders: number;
  revenue: string;
}

export type PipelineStatus = 'PENDING' | 'IN_PREPARATION' | 'READY_FOR_PICKUP' | 'READY_FOR_FREIGHT';

export interface Overview {
  range: { from: string; to: string; days: number };
  timezone: string;
  totals: PeriodTotals;
  previous: PeriodTotals;
  series: { day: string; orders: number; revenue: string }[];
  topProducts: { productId: string; sku: string; name: string; units: number; revenue: string }[];
  byDelivery: Slice[];
  byCustomerType: Slice[];
  byBranch: Slice[] | null;
  pipeline: Partial<Record<PipelineStatus, number>>;
}

export interface LowStockRow {
  stock: number;
  reserved: number;
  available: number;
  branch: { id: string; name: string };
  product: { id: string; sku: string; name: string };
}

export type Rank = 'revenue' | 'units';

export interface OverviewParams {
  from?: string;
  to?: string;
  rank: Rank;
  branchId?: string;
}

export function useOverview({ from, to, rank, branchId }: OverviewParams) {
  return useQuery({
    queryKey: ['backoffice', 'overview', from ?? '', to ?? '', rank, branchId ?? 'own'],
    queryFn: () => api<Overview>(withBranch(`/backoffice/analytics/overview${queryString({ from, to, rank })}`, branchId)),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useLowStock(branchId: string | undefined, threshold: number) {
  return useQuery({
    queryKey: ['backoffice', 'low-stock', branchId ?? 'own', threshold],
    queryFn: () => api<LowStockRow[]>(withBranch(`/backoffice/analytics/low-stock${queryString({ threshold, limit: 15 })}`, branchId)),
    staleTime: 60_000,
  });
}
