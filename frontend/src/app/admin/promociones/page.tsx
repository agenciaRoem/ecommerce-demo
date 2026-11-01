import type { Metadata } from 'next';
import { PromotionsManager } from '@/components/backoffice/promotions/promotions-manager';

export const metadata: Metadata = { title: 'Promociones' };

export default function PromotionsPage() {
  return <PromotionsManager />;
}
