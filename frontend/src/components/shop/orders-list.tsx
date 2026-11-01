'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/money';
import { useOrders } from '@/lib/shop-api';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from './order-status';
import { SignedOutNotice } from './signed-out-notice';
import { useCustomerGate } from './use-customer-gate';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export function OrdersList() {
  const gate = useCustomerGate();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData } = useOrders(page);

  if (gate === 'signedOut') return <SignedOutNotice returnTo="/pedidos" what="tus pedidos" />;
  if (gate === 'loading' || isPending) return <Skeleton className="h-48" />;
  if (isError || !data) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">No pudimos cargar tus pedidos.</p>;

  if (data.total === 0) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-10 text-center ring-1 ring-black/5">
        <p className="font-semibold">Todavía no hiciste ningún pedido</p>
        <Link href="/productos" className="text-sm font-semibold text-brand underline underline-offset-4">
          Ver productos
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.limit);
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="orders-list">
        {data.items.map((order) => (
          <li key={order.id}>
            <Link href={`/pedidos/${order.id}`} className="flex items-center gap-3 p-4 hover:bg-brand-soft">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Pedido #{order.number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.createdAt)} · {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'} · {order.branch.name}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', ORDER_STATUS_TONE[order.status])}>{ORDER_STATUS_LABEL[order.status]}</span>
              <p className="w-28 shrink-0 text-right font-bold">{formatPrice(order.total)}</p>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1 || isPlaceholderData} onClick={() => setPage((p) => p - 1)}>
            Anteriores
          </Button>
          <span>
            {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || isPlaceholderData} onClick={() => setPage((p) => p + 1)}>
            Siguientes
          </Button>
        </div>
      )}
    </div>
  );
}
