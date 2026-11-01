import type { Metadata } from 'next';
import { AuditLog } from '@/components/backoffice/audit-log';

export const metadata: Metadata = { title: 'Auditoría' };

export default function AuditLogPage() {
  return <AuditLog />;
}
