'use client';

import { MailIcon, PhoneIcon } from 'lucide-react';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useAbandonedCarts } from '@/lib/backoffice/carts';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Pager, Pill, formatDateTime } from './common';

const IDLE_OPTIONS = [
  { value: 60, label: 'Más de 1 hora sin tocar' },
  { value: 360, label: 'Más de 6 horas' },
  { value: 1440, label: 'Más de 1 día' },
  { value: 4320, label: 'Más de 3 días' },
];

export function AbandonedCarts() {
  const [idle, setIdle] = useState(60);
  const [page, setPage] = useState(1);
  const carts = useAbandonedCarts(idle, page);

  return (
    <>
      <PageHeader
        title="Carritos abandonados"
        description="Clientes que dejaron productos en el carrito sin comprar. Es una oportunidad para contactarlos. Los carritos no pertenecen a una sucursal: se elige recién al pagar."
        actions={
          <NativeSelect
            aria-label="Tiempo sin actividad"
            className="h-10 w-64 text-sm"
            value={idle}
            onChange={(e) => {
              setIdle(Number(e.target.value));
              setPage(1);
            }}
          >
            {IDLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />

      {carts.isPending ? (
        <ListSkeleton />
      ) : carts.isError ? (
        <LoadError />
      ) : carts.data.items.length === 0 ? (
        <EmptyState>No hay carritos abandonados con ese criterio.</EmptyState>
      ) : (
        <div className={cn('space-y-3', carts.isPlaceholderData && 'opacity-60')}>
          <p className="text-sm text-muted-foreground">
            {carts.data.total} {carts.data.total === 1 ? 'carrito' : 'carritos'} · el valor es a precio de lista, sin promociones.
          </p>
          <ul className="space-y-3" data-testid="carts-list">
            {carts.data.items.map((cart) => (
              <li key={cart.customer.id} className="rounded-xl bg-white p-4 ring-1 ring-black/5" data-testid="cart-item">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {cart.customer.businessName ?? cart.customer.name}
                      <Pill tone={cart.customer.type === 'COMMERCE' ? 'info' : 'muted'}>{cart.customer.type === 'COMMERCE' ? 'Comercio' : 'Consumidor final'}</Pill>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <a href={`mailto:${cart.customer.email}`} className="flex items-center gap-1 hover:text-brand">
                        <MailIcon className="size-3.5" aria-hidden /> {cart.customer.email}
                      </a>
                      {cart.customer.phone && (
                        <a href={`tel:${cart.customer.phone}`} className="flex items-center gap-1 hover:text-brand">
                          <PhoneIcon className="size-3.5" aria-hidden /> {cart.customer.phone}
                        </a>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold">{formatMoney(cart.estimatedValue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {cart.units} {cart.units === 1 ? 'unidad' : 'unidades'} · última actividad {formatDateTime(cart.lastActivityAt)}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 divide-y border-t text-sm">
                  {cart.lines.map((line) => (
                    <li key={line.productId} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">
                        <b>{line.quantity}×</b> {line.name}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{formatMoney(Number(line.unitPrice) * line.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <Pager page={page} limit={carts.data.limit} total={carts.data.total} onPage={setPage} disabled={carts.isPlaceholderData} />
        </div>
      )}
    </>
  );
}
