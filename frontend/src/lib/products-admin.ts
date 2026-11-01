'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Page, Product } from './api-types';
import { queryString } from './branch-scope';

/** Alta y edición de productos (`/products`). El precio, el costo y el stock tienen sus propios circuitos. */

export interface ProductUpdate {
  name?: string;
  barcode?: string | null;
  categoryId?: string;
  description?: string | null;
  imageKey?: string;
}

export function useProductList(search: string, page: number) {
  return useQuery({
    queryKey: ['products', 'list', search, page],
    queryFn: () => api<Page<Product>>(`/products${queryString({ search, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ProductUpdate & { id: string }) => api<Product>(`/products/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['lookup'] });
    },
  });
}
