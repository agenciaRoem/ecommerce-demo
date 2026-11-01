import type { Metadata } from 'next';
import { AbandonedCarts } from '@/components/backoffice/abandoned-carts';

export const metadata: Metadata = { title: 'Carritos abandonados' };

export default function AbandonedCartsPage() {
  return <AbandonedCarts />;
}
