'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Page, Role } from '../api-types';
import { queryString } from '../branch-scope';

/** Contratos de la administración (solo SUPERADMIN): sucursales, personal, auditoría, comercios y pagos a revisar. */

// ───────── Sucursales ─────────

export interface AdminBranch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  isActive: boolean;
  activeStaff: number;
  openOrders: number;
}

export interface BranchInput {
  name: string;
  code: string;
  address: string;
  phone?: string;
}

export interface BranchUpdate {
  name?: string;
  address?: string;
  phone?: string | null;
  isActive?: boolean;
}

export function useAdminBranches(enabled = true) {
  return useQuery({ queryKey: ['backoffice', 'branches'], queryFn: () => api<AdminBranch[]>('/backoffice/branches'), staleTime: 60_000, enabled });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchInput) => api<AdminBranch>('/backoffice/branches', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'branches'] }),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: BranchUpdate & { id: string }) => api<AdminBranch>(`/backoffice/branches/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'branches'] }),
  });
}

// ───────── Personal ─────────

export interface StaffMember {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branch: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
}

export interface StaffFilters {
  search: string;
  role: Role | '';
  branchId: string;
  status: 'all' | 'active' | 'inactive';
  page: number;
}

export interface StaffInput {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  branchId?: string;
}

export interface StaffUpdate {
  fullName?: string;
  role?: Role;
  branchId?: string | null;
  isActive?: boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  GERENTE: 'Gerente',
  SALA: 'Sala',
  STOCKEO: 'Stockeo',
  ENCARGADO_STOCK: 'Encargado de stock',
};

export function useStaff(filters: StaffFilters) {
  return useQuery({
    queryKey: ['backoffice', 'staff', filters],
    queryFn: () =>
      api<Page<StaffMember>>(
        `/backoffice/staff${queryString({ search: filters.search, role: filters.role, branchId: filters.branchId, status: filters.status, page: filters.page, limit: 20 })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInput) => api<StaffMember>('/backoffice/staff', { method: 'POST', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'staff'] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: StaffUpdate & { id: string }) => api<StaffMember>(`/backoffice/staff/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backoffice', 'staff'] });
      void queryClient.invalidateQueries({ queryKey: ['backoffice', 'branches'] });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api<void>(`/backoffice/staff/${id}/password`, { method: 'POST', json: { password } }),
  });
}

// ───────── Auditoría ─────────

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { id: string; fullName: string; email: string } | null;
  metadata: unknown;
  ip: string | null;
}

export interface AuditFilters {
  entity: string;
  action: string;
  from: string;
  to: string;
  page: number;
}

export function useAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: ['backoffice', 'audit', filters],
    queryFn: () =>
      api<Page<AuditEntry>>(
        `/backoffice/audit${queryString({ entity: filters.entity, action: filters.action, from: filters.from, to: filters.to, page: filters.page, limit: 30 })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAuditFacets() {
  return useQuery({
    queryKey: ['backoffice', 'audit-facets'],
    queryFn: () => api<{ entities: string[]; actions: string[] }>('/backoffice/audit/facets'),
    staleTime: 5 * 60_000,
  });
}

// ───────── Comercios (aprobación de CUIT) ─────────

export interface CommerceCustomer {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  cuit: string;
  cuitVerified: boolean;
  isActive: boolean;
  createdAt: string;
  orders: number;
}

export type CommerceStatus = 'pending' | 'verified' | 'all';

export function useCommerce(status: CommerceStatus, search: string, page: number) {
  return useQuery({
    queryKey: ['backoffice', 'commerce', status, search, page],
    queryFn: () => api<Page<CommerceCustomer>>(`/backoffice/commerce-customers${queryString({ status, search, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useVerifyCuit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verified, note }: { id: string; verified: boolean; note: string }) =>
      api<{ cuitVerified: boolean }>(`/backoffice/commerce-customers/${id}/cuit-verification`, { method: 'POST', json: { verified, note } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'commerce'] }),
  });
}

// ───────── Pagos a revisar ─────────

export interface PaymentIssue {
  id: string;
  number: number;
  status: string;
  total: string;
  issue: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  createdAt: string;
  branch: string;
  customer: { name: string; email: string; phone: string | null };
}

export function usePaymentIssues(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['backoffice', 'payment-issues'],
    queryFn: () => api<PaymentIssue[]>('/backoffice/payment-issues'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useResolveIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) => api<void>(`/backoffice/payment-issues/${orderId}/resolve`, { method: 'POST', json: { note } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backoffice', 'payment-issues'] }),
  });
}
