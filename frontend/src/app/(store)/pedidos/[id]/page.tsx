import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrderStatusPanel } from '@/components/shop/order-status-panel';
import { Container } from '@/components/store/container';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Mi pedido' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Container className="max-w-4xl py-6">
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Order params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Order({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Mercado Pago agrega estos datos al volver. Se usan solo como pista: el servidor verifica el pago con Mercado Pago.
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const paymentId = [first(query.payment_id), first(query.collection_id)].find((value) => value && /^\d{1,20}$/.test(value));
  const returning = Boolean(paymentId || first(query.status) || first(query.collection_status));

  return <OrderStatusPanel orderId={id} returning={returning} paymentId={paymentId} />;
}
