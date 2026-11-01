import type { Metadata } from 'next';
import { StaffManager } from '@/components/backoffice/staff-manager';

export const metadata: Metadata = { title: 'Personal' };

export default function StaffManagerPage() {
  return <StaffManager />;
}
