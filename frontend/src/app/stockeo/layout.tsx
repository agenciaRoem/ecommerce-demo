import type { ReactNode } from 'react';
import { StaffGate } from '@/components/auth/staff-gate';
import { StockeoShell } from '@/components/stockeo/stockeo-shell';

export default function StockeoLayout({ children }: { children: ReactNode }) {
  return (
    <StaffGate allowed={['STOCKEO', 'GERENTE']}>
      <StockeoShell>{children}</StockeoShell>
    </StaffGate>
  );
}
