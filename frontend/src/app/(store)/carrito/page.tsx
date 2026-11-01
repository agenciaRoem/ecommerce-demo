import type { Metadata } from 'next';
import { CartPanel } from '@/components/shop/cart-panel';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Mi carrito' };

export default function CartPage() {
  return (
    <Container className="space-y-5 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Mi carrito</h1>
      <CartPanel />
    </Container>
  );
}
