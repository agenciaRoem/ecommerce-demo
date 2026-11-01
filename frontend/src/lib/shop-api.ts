'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { ImageUrls, Page } from './api-types';
import type { PriceView } from './catalog-types';
import { hasCustomerFlag } from './customer-session';

/** Contratos de carrito, checkout y pedidos del cliente (`/cart`, `/checkout`, `/orders`). */

export interface CartLine {
  productId: string;
  name: string;
  image: ImageUrls | null;
  quantity: number;
  price: PriceView;
  lineTotal: string;
}

export interface BranchFulfillment {
  id: string;
  name: string;
  address: string;
  canFulfill: boolean;
  shortages: { productId: string; name: string; requested: number; available: number }[];
}

export interface Cart {
  lines: CartLine[];
  count: number;
  subtotal: string;
  branches: BranchFulfillment[];
}

export type DeliveryMethod = 'PICKUP' | 'SHIPPING';

export interface CheckoutOptions {
  paymentsEnabled: boolean;
  testMode: boolean;
  deliveryMethods: DeliveryMethod[];
  shippingAddress: string | null;
  emailVerificationRequired: boolean;
  email: string;
}

export interface CheckoutInput {
  deliveryMethod: DeliveryMethod;
  branchId: string;
  shippingAddress?: string;
  note?: string;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING'
  | 'IN_PREPARATION'
  | 'READY_FOR_PICKUP'
  | 'READY_FOR_FREIGHT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  productId: string;
  name: string;
  image: ImageUrls | null;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  lineTotal: string;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  branch: { id: string; name: string; address: string };
  shippingAddress: string | null;
  note: string | null;
  items: OrderItem[];
  subtotal: string;
  shippingCost: string;
  total: string;
  paymentStatus: string | null;
  needsReview: boolean;
  checkoutUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  cancelReason: string | null;
  /** Por qué estados pasó el pedido y cuándo. */
  history: { status: OrderStatus; at: string }[];
}

const call = <T>(path: string, init?: Parameters<typeof api>[1]) => api<T>(path, { audience: 'customer', ...init });

const keys = {
  cart: ['shop', 'cart'] as const,
  count: ['shop', 'cart', 'count'] as const,
  options: ['shop', 'checkout-options'] as const,
  orders: ['shop', 'orders'] as const,
  order: (id: string) => ['shop', 'order', id] as const,
};

/** Solo consulta si hay una sesión de cliente (la marca la deja el login). */
const signedIn = () => hasCustomerFlag();

export function useCartCount() {
  return useQuery({ queryKey: keys.count, queryFn: () => call<{ count: number }>('/cart/count'), enabled: signedIn, staleTime: 15_000, retry: false });
}

export function useCart() {
  return useQuery({ queryKey: keys.cart, queryFn: () => call<Cart>('/cart'), enabled: signedIn, staleTime: 0, retry: false });
}

/** Tras cualquier cambio el servidor devuelve el carrito completo, con precios y stock actualizados. */
function useCartMutation<TVariables>(request: (variables: TVariables) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (cart) => {
      queryClient.setQueryData(keys.cart, cart);
      queryClient.setQueryData(keys.count, { count: cart.count });
    },
  });
}

export const useAddToCart = () =>
  useCartMutation(({ productId, quantity }: { productId: string; quantity: number }) =>
    call<Cart>('/cart/items', { method: 'POST', json: { productId, quantity } }),
  );

export const useSetCartQuantity = () =>
  useCartMutation(({ productId, quantity }: { productId: string; quantity: number }) =>
    call<Cart>(`/cart/items/${productId}`, { method: 'PATCH', json: { quantity } }),
  );

export const useRemoveFromCart = () =>
  useCartMutation((productId: string) => call<Cart>(`/cart/items/${productId}`, { method: 'DELETE' }));

export function useCheckoutOptions() {
  return useQuery({ queryKey: keys.options, queryFn: () => call<CheckoutOptions>('/checkout/options'), enabled: signedIn, staleTime: 0, retry: false });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => call<{ order: Order; checkoutUrl: string }>('/checkout', { method: 'POST', json: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.orders }),
  });
}

export function useOrders(page: number) {
  return useQuery({
    queryKey: [...keys.orders, page],
    queryFn: () => call<Page<Order>>(`/orders?page=${page}&limit=10`),
    enabled: signedIn,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/** Mientras `keepPolling(pedido)` sea verdadero vuelve a consultar cada pocos segundos (espera de la confirmación del pago). */
export function useOrder(id: string, keepPolling?: (order: Order) => boolean) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => call<Order>(`/orders/${id}`),
    enabled: signedIn,
    retry: false,
    refetchInterval: (query) => (query.state.data && keepPolling?.(query.state.data) ? 4_000 : false),
  });
}

/** Pide al servidor que verifique el pago con Mercado Pago (no confía en lo que diga la URL). */
export function useSyncOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId?: string) => call<Order>(`/orders/${id}/sync`, { method: 'POST', json: paymentId ? { paymentId } : {} }),
    onSuccess: (order) => {
      queryClient.setQueryData(keys.order(id), order);
      void queryClient.invalidateQueries({ queryKey: keys.cart });
      void queryClient.invalidateQueries({ queryKey: keys.count });
    },
  });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => call<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: (order) => {
      queryClient.setQueryData(keys.order(id), order);
      void queryClient.invalidateQueries({ queryKey: keys.orders });
    },
  });
}
