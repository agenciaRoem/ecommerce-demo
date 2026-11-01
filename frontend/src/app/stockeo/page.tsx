import type { Metadata } from 'next';
import { InventoryList } from '@/components/stockeo/inventory-list';
import { LookupPanel } from '@/components/stockeo/lookup-panel';

export const metadata: Metadata = { title: 'Stockeo' };

export default function StockeoHomePage() {
  return (
    <>
      <LookupPanel />
      <InventoryList />
    </>
  );
}
