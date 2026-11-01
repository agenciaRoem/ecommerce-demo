import type { Metadata } from 'next';
import { PaymentIssues } from '@/components/backoffice/payment-issues';

export const metadata: Metadata = { title: 'Pagos a revisar' };

export default function PaymentIssuesPage() {
  return <PaymentIssues />;
}
