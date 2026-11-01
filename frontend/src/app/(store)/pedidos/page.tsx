import type { Metadata } from 'next';
import { OrdersList } from '@/components/shop/orders-list';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Mis pedidos' };

export default function OrdersPage() {
  return (
    <Container className="max-w-3xl space-y-5 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Mis pedidos</h1>
      <OrdersList />
    </Container>
  );
}
