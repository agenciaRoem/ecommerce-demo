'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { ImageUrls, Page } from './api-types';
import { withBranch } from './branch-scope';

/** Contratos del panel de operaciones de sucursal (`/branch/orders`, `/inventory/adjustments`). */

export type StaffOrderStatus = 'PENDING' | 'IN_PREPARATION' | 'READY_FOR_PICKUP' | 'READY_FOR_FREIGHT' | 'COMPLETED';
type AnyStatus = StaffOrderStatus | 'PENDING_PAYMENT' | 'CANCELLED';

export interface StaffOrderItem {
  productId: string;
  sku: string;
  barcode: string | null;
  name: string;
  quantity: number;
  image: ImageUrls | null;
}

export interface StaffOrder {
  id: string;
  number: number;
  status: StaffOrderStatus;
  deliveryMethod: 'PICKUP' | 'SHIPPING';
  branch: { id: string; name: string };
  customer: { name: string; phone: string | null; businessName: string | null };
  shippingAddress: string | null;
  note: string | null;
  items: StaffOrderItem[];
  units: number;
  total: string;
  paidAt: string | null;
  createdAt: string;
  statusSince: string;
  history: { status: AnyStatus; at: string }[];
  actions: { forward: StaffOrderStatus | null; back: StaffOrderStatus | null };
}

export type QueueSummary = Record<Exclude<StaffOrderStatus, 'COMPLETED'>, number>;

export type AdjustmentReason = 'DAMAGED' | 'LOST' | 'FOUND' | 'RETURN' | 'OTHER';

export interface AdjustmentInput {
  productId: string;
  delta: number;
  reason: AdjustmentReason;
  note?: string;
}

/** Pedidos de la cola que se piden de una vez. Si hay más, el panel lo avisa (ver `OrdersBoard`). */
export const QUEUE_LIMIT = 300;

/** El panel está abierto todo el día en el mostrador: se refresca solo y al volver a la pestaña. */
const LIVE = { refetchInterval: 15_000, refetchOnWindowFocus: true, staleTime: 0 } as const;

const keys = {
  queue: (branchId: string | undefined, search: string) => ['sala', 'queue', branchId ?? 'own', search] as const,
  done: (branchId: string | undefined, search: string, page: number) => ['sala', 'done', branchId ?? 'own', search, page] as const,
  summary: (branchId: string | undefined) => ['sala', 'summary', branchId ?? 'own'] as const,
};

export function useQueue(branchId: string | undefined, search: string) {
  return useQuery({
    queryKey: keys.queue(branchId, search),
    queryFn: () => {
      const params = new URLSearchParams({ view: 'active', limit: String(QUEUE_LIMIT) });
      if (search) params.set('search', search);
      return api<Page<StaffOrder>>(withBranch(`/branch/orders?${params}`, branchId));
    },
    placeholderData: keepPreviousData,
    ...LIVE,
  });
}

export function useDelivered(branchId: string | undefined, search: string, page: number) {
  return useQuery({
    queryKey: keys.done(branchId, search, page),
    queryFn: () => {
      const params = new URLSearchParams({ view: 'completed', limit: '20', page: String(page) });
      if (search) params.set('search', search);
      return api<Page<StaffOrder>>(withBranch(`/branch/orders?${params}`, branchId));
    },
    placeholderData: keepPreviousData,
  });
}

export function useSummary(branchId: string | undefined) {
  return useQuery({
    queryKey: keys.summary(branchId),
    queryFn: () => api<QueueSummary>(withBranch('/branch/orders/summary', branchId)),
    ...LIVE,
  });
}

export function useTransition(branchId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: StaffOrderStatus }) =>
      api<StaffOrder>(withBranch(`/branch/orders/${orderId}/status`, branchId), { method: 'POST', json: { status } }),
    // Gane o pierda la carrera con otro empleado, la pantalla se pone al día con lo que dice el servidor.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sala'] }),
  });
}

export function useAdjustStock(branchId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustmentInput) =>
      api<{ stock: number; reserved: number; available: number }>(withBranch('/inventory/adjustments', branchId), { method: 'POST', json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['lookup'] });
    },
  });
}

/** Stock de una sucursal para el buscador del ajuste (el hook de la carga usa la sucursal propia del usuario). */
export function useBranchInventory(branchId: string | undefined, search: string) {
  return useQuery({
    queryKey: ['inventory', 'sala', branchId ?? 'own', search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '12' });
      if (search) params.set('search', search);
      return api<Page<InventoryRow>>(withBranch(`/inventory?${params}`, branchId));
    },
    enabled: search.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export interface InventoryRow {
  branchId: string;
  stock: number;
  reserved: number;
  available: number;
  product: { id: string; sku: string; barcode: string | null; name: string; image: ImageUrls | null };
}

export const STATUS_LABEL: Record<StaffOrderStatus, string> = {
  PENDING: 'Pendiente',
  IN_PREPARATION: 'En preparación',
  READY_FOR_PICKUP: 'Listo para retirar',
  READY_FOR_FREIGHT: 'Listo para flete',
  COMPLETED: 'Entregado',
};

/** Texto del botón que lleva al pedido a `to`. */
export function forwardLabel(to: StaffOrderStatus, delivery: StaffOrder['deliveryMethod']): string {
  switch (to) {
    case 'IN_PREPARATION':
      return 'Empezar a preparar';
    case 'READY_FOR_PICKUP':
      return 'Listo para retirar';
    case 'READY_FOR_FREIGHT':
      return 'Listo para flete';
    case 'COMPLETED':
      return delivery === 'PICKUP' ? 'Entregado al cliente' : 'Despachado';
    default:
      return STATUS_LABEL[to];
  }
}

export const backLabel = (to: StaffOrderStatus) => `Volver a «${STATUS_LABEL[to]}»`;
