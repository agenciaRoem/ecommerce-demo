'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { customerKey } from './customer-session';

/** Verificación de email y recuperación de contraseña. Clientes (`/customers/...`) y personal (`/auth/...`). */

export type RecoveryAudience = 'customer' | 'staff';

const PASSWORD_BASE: Record<RecoveryAudience, string> = { customer: '/customers/password', staff: '/auth/password' };

export function useForgotPassword(audience: RecoveryAudience) {
  return useMutation({
    mutationFn: (email: string) => api<void>(`${PASSWORD_BASE[audience]}/forgot`, { method: 'POST', json: { email }, audience }),
  });
}

export function useResetPassword(audience: RecoveryAudience) {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) => api<void>(`${PASSWORD_BASE[audience]}/reset`, { method: 'POST', json: input, audience }),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api<void>('/customers/verify-email', { method: 'POST', json: { token }, audience: 'customer' }),
    // Si esa misma persona tiene la tienda abierta, el aviso de "confirmá tu email" tiene que desaparecer.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKey }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => api<void>('/customers/verify-email/resend', { method: 'POST', audience: 'customer' }) });
}

/** Formas de ingreso que la tienda tiene habilitadas (hoy: Google). Es pública. */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api<{ google: boolean }>('/customers/auth/providers', { audience: 'customer' }),
    staleTime: 10 * 60_000,
    retry: false,
  });
}
