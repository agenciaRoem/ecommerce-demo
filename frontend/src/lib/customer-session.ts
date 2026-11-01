'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { CustomerProfile, CustomerType } from './catalog-types';

export const customerKey = ['customer'] as const;

/**
 * Marca no sensible (la sesión real vive en cookies HttpOnly que JavaScript no puede leer): evita
 * consultar a la API en cada visita de alguien que nunca inició sesión.
 */
const FLAG_COOKIE = 'omni_customer';
const FLAG_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const hasCustomerFlag = () =>
  typeof document !== 'undefined' && document.cookie.split('; ').some((c) => c.startsWith(`${FLAG_COOKIE}=`));
const setFlag = () => {
  document.cookie = `${FLAG_COOKIE}=1; path=/; max-age=${FLAG_MAX_AGE_SECONDS}; samesite=strict`;
};
/** Para quien entró por una redirección del servidor (Google) y no pasó por el formulario de ingreso. */
export const markCustomerSession = setFlag;
const clearFlag = () => {
  document.cookie = `${FLAG_COOKIE}=; path=/; max-age=0; samesite=strict`;
};

export function useCustomerSession() {
  return useQuery({
    queryKey: customerKey,
    queryFn: async () => {
      try {
        return await api<CustomerProfile>('/customers/me', { audience: 'customer' });
      } catch (error) {
        clearFlag();
        throw error;
      }
    },
    enabled: () => hasCustomerFlag(),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useCustomerLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<CustomerProfile>('/customers/auth/login', { method: 'POST', json: credentials, audience: 'customer' }),
    onSuccess: (profile) => {
      setFlag();
      queryClient.setQueryData(customerKey, profile);
    },
  });
}

export type RegisterInput =
  | { type: Extract<CustomerType, 'RETAIL'>; email: string; password: string; fullName: string; phone?: string }
  | {
      type: Extract<CustomerType, 'COMMERCE'>;
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      businessName: string;
      cuit: string;
      shippingAddress?: string;
    };

export function useCustomerRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<CustomerProfile>('/customers/register', { method: 'POST', json: input, audience: 'customer' }),
    onSuccess: (profile) => {
      setFlag();
      queryClient.setQueryData(customerKey, profile);
    },
  });
}

export function useCustomerLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/customers/auth/logout', { method: 'POST', audience: 'customer' }),
    onSettled: () => {
      clearFlag();
      queryClient.removeQueries({ queryKey: customerKey });
    },
  });
}
