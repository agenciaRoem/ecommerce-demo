import type { Metadata } from 'next';
import { PricesManager } from '@/components/backoffice/prices/prices-manager';

export const metadata: Metadata = { title: 'Precios y costos' };

export default function PricesPage() {
  return <PricesManager />;
}
