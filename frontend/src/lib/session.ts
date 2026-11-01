'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Profile, Role } from './api-types';

export const sessionKey = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: () => api<Profile>('/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<Profile>('/auth/login', { method: 'POST', json: credentials }),
    onSuccess: (profile) => queryClient.setQueryData(sessionKey, profile),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => queryClient.clear(),
  });
}

/** Pantalla de inicio de cada rol. Los roles sin interfaz todavía vuelven a la portada . */
export function homeFor(role: Role): string {
  if (role === 'SUPERADMIN' || role === 'GERENTE') return '/admin';
  if (role === 'ENCARGADO_STOCK') return '/encargado';
  return role === 'SALA' ? '/sala' : '/stockeo';
}
