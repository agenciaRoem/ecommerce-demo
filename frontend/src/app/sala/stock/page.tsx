import type { Metadata } from 'next';
import { StockAdjuster } from '@/components/sala/stock-adjuster';

export const metadata: Metadata = { title: 'Ajuste de stock' };

export default function SalaStockPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <StockAdjuster />
    </div>
  );
}
