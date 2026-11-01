'use client';

import { Loader2Icon, MessageSquareTextIcon, StoreIcon, TruckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaffOrder, forwardLabel } from '@/lib/sala-api';
import { cn } from '@/lib/utils';
import { timeAgo, waitLevel } from './use-now';

const WAIT_STYLE = { ok: 'text-muted-foreground', warn: 'font-semibold text-warning', late: 'font-bold text-sale' } as const;

interface OrderCardProps {
  order: StaffOrder;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onAdvance: () => void;
}

/** Un pedido en la cola: lo esencial a simple vista y el botón del paso siguiente al alcance del pulgar. */
export function OrderCard({ order, now, busy, onOpen, onAdvance }: OrderCardProps) {
  const Delivery = order.deliveryMethod === 'PICKUP' ? StoreIcon : TruckIcon;
  const level = waitLevel(order.statusSince, now);
  const forward = order.actions.forward;

  return (
    <li className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5" data-testid="order-card" data-number={order.number}>
      <button type="button" onClick={onOpen} className="block w-full space-y-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <div className="flex items-center justify-between gap-2">
          <p className="text-lg font-extrabold">#{order.number}</p>
          <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            <Delivery className="size-3.5" aria-hidden />
            {order.deliveryMethod === 'PICKUP' ? 'Retiro' : 'Envío'}
          </span>
        </div>
        <p className="truncate text-sm font-medium">{order.customer.businessName ?? order.customer.name}</p>
        <p className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {order.units} {order.units === 1 ? 'unidad' : 'unidades'} · {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}
          </span>
          <span className={WAIT_STYLE[level]}>{timeAgo(order.statusSince, now)}</span>
        </p>
        {order.note && (
          <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
            <MessageSquareTextIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{order.note}</span>
          </p>
        )}
      </button>

      {forward && (
        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={onAdvance}
          className={cn('mt-3 h-11 w-full bg-brand text-sm text-white hover:bg-brand-dark')}
        >
          {busy && <Loader2Icon className="animate-spin" />}
          {forwardLabel(forward, order.deliveryMethod)}
        </Button>
      )}
    </li>
  );
}
