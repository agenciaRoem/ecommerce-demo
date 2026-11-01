import type { Metadata } from 'next';
import { BranchesManager } from '@/components/backoffice/branches-manager';

export const metadata: Metadata = { title: 'Sucursales' };

export default function BranchesManagerPage() {
  return <BranchesManager />;
}
