import type { Metadata } from 'next';
import { OrdersBoard } from '@/components/sala/orders-board';

export const metadata: Metadata = { title: 'Pedidos' };

export default function SalaOrdersPage() {
  return <OrdersBoard />;
}
