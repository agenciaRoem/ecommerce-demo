import type { Metadata } from 'next';
import { CommerceApprovals } from '@/components/backoffice/commerce-approvals';

export const metadata: Metadata = { title: 'Comercios' };

export default function CommerceApprovalsPage() {
  return <CommerceApprovals />;
}
