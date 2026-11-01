'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type GatewayMode = 'SANDBOX' | 'PRODUCTION';

/** Estado de la pasarela tal como lo expone la API. Los secretos nunca llegan: solo pistas de 4 caracteres. */
export interface GatewayView {
  provider: 'MERCADOPAGO';
  isEnabled: boolean;
  mode: GatewayMode;
  publicKey: string | null;
  hasAccessToken: boolean;
  accessTokenHint: string | null;
  hasWebhookSecret: boolean;
  webhookSecretHint: string | null;
  account: { id: string; label: string; siteId: string | null } | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  ready: boolean;
  webhookUrl: string;
  updatedAt: string | null;
}

export interface GatewayPatch {
  mode?: GatewayMode;
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
  isEnabled?: boolean;
}

export interface WebhookEvent {
  id: string;
  topic: string;
  action: string | null;
  resourceId: string;
  liveMode: boolean | null;
  receivedAt: string;
}

const BASE = '/admin/payments/mercadopago';
const gatewayKey = ['admin', 'payments', 'mercadopago'] as const;
const eventsKey = [...gatewayKey, 'events'] as const;

export function useGateway() {
  return useQuery({ queryKey: gatewayKey, queryFn: () => api<GatewayView>(BASE), staleTime: 0 });
}

export function useSaveGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: GatewayPatch) => api<GatewayView>(BASE, { method: 'PUT', json: patch }),
    onSuccess: (view) => queryClient.setQueryData(gatewayKey, view),
  });
}

export function useVerifyGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean; view: GatewayView }>(`${BASE}/verify`, { method: 'POST' }),
    onSuccess: ({ view }) => queryClient.setQueryData(gatewayKey, view),
  });
}

export function useDisconnectGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<GatewayView>(BASE, { method: 'DELETE' }),
    onSuccess: (view) => {
      queryClient.setQueryData(gatewayKey, view);
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

/** Avisos recibidos de Mercado Pago; se refresca solo para ver llegar un aviso de prueba. */
export function useGatewayEvents() {
  return useQuery({
    queryKey: eventsKey,
    queryFn: () => api<WebhookEvent[]>(`${BASE}/events?limit=10`),
    refetchInterval: 15_000,
  });
}
