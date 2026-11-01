import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffGate } from '@/components/auth/staff-gate';
import { EncargadoShell } from '@/components/encargado/encargado-shell';

export const metadata: Metadata = {
  title: { default: 'Productos', template: '%s · Productos' },
  robots: { index: false, follow: false },
};

export default function EncargadoLayout({ children }: { children: ReactNode }) {
  return (
    <StaffGate allowed={['ENCARGADO_STOCK', 'GERENTE', 'SUPERADMIN']}>
      <EncargadoShell>{children}</EncargadoShell>
    </StaffGate>
  );
}
