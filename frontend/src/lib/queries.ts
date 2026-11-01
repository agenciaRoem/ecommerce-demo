'use client';

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from './api';
import type {
  Category,
  CreateProductInput,
  InventoryRow,
  Page,
  Product,
  StockLevel,
  UploadedImage,
} from './api-types';

export const LOW_STOCK_THRESHOLD = 5;

const keys = {
  categories: ['categories'] as const,
  lookup: (code: string) => ['lookup', code] as const,
  inventory: (search: string, lowStock: boolean) => ['inventory', { search, lowStock }] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api<Category[]>('/categories'),
    staleTime: 30 * 60_000,
  });
}

/** Búsqueda exacta por código de barras o SKU. Un 404 es un resultado esperado, no un error de red. */
export function useLookup(code: string) {
  return useQuery({
    queryKey: keys.lookup(code),
    queryFn: async () => {
      try {
        return await api<Product>(`/products/lookup?code=${encodeURIComponent(code)}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: code.length > 0,
    retry: false,
  });
}

export function useInventory(search: string, lowStock: boolean) {
  return useInfiniteQuery({
    queryKey: keys.inventory(search, lowStock),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: '20' });
      if (search) params.set('search', search);
      if (lowStock) params.set('maxStock', String(LOW_STOCK_THRESHOLD));
      return api<Page<InventoryRow>>(`/inventory?${params}`);
    },
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: Blob) => {
      const body = new FormData();
      body.append('file', file, 'foto.jpg');
      return api<UploadedImage>('/media/images', { method: 'POST', body });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => api<Product>('/products', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useReceiveStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; quantity: number }) =>
      api<StockLevel & { productId: string }>('/inventory/receipts', { method: 'POST', json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['lookup'] });
    },
  });
}
