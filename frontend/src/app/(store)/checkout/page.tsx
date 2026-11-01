import type { Metadata } from 'next';
import { CheckoutPanel } from '@/components/shop/checkout-panel';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Finalizar compra' };

export default function CheckoutPage() {
  return (
    <Container className="space-y-5 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Finalizar compra</h1>
      <CheckoutPanel />
    </Container>
  );
}
