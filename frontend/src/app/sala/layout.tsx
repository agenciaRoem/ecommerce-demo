import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffGate } from '@/components/auth/staff-gate';
import { SalaShell } from '@/components/sala/sala-shell';

export const metadata: Metadata = {
  title: { default: 'Sala', template: '%s · Sala' },
  robots: { index: false, follow: false },
};

export default function SalaLayout({ children }: { children: ReactNode }) {
  return (
    <StaffGate allowed={['SALA', 'GERENTE', 'SUPERADMIN']}>
      <SalaShell>{children}</SalaShell>
    </StaffGate>
  );
}
