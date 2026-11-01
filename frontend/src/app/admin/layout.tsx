import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { StaffGate } from '@/components/auth/staff-gate';

export const metadata: Metadata = {
  title: { default: 'Backoffice', template: '%s · Backoffice' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <StaffGate allowed={['SUPERADMIN', 'GERENTE']}>
      <AdminShell>{children}</AdminShell>
    </StaffGate>
  );
}
