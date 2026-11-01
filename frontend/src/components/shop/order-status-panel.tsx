'use client';

import { CheckCircle2Icon, ClockIcon, Loader2Icon, StoreIcon, TruckIcon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { Order, useCancelOrder, useOrder, useSyncOrder } from '@/lib/shop-api';
import { cn } from '@/lib/utils';
import { CANCEL_REASON_TEXT, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from './order-status';
import { OrderSummary } from './order-summary';
import { SignedOutNotice } from './signed-out-notice';
import { useCountdown } from './use-countdown';
import { useCustomerGate } from './use-customer-gate';

/** Cuánto se espera el aviso de Mercado Pago tras volver del pago antes de dejar de insistir. */
const WAIT_FOR_CONFIRMATION_MS = 3 * 60_000;
const SYNC_EVERY_MS = 6_000;
const FINAL_FAILURES = new Set(['rejected', 'cancelled']);

function Banner({ tone, icon: Icon, title, children }: { tone: 'ok' | 'wait' | 'bad' | 'neutral'; icon: typeof ClockIcon; title: string; children?: React.ReactNode }) {
  const styles = {
    ok: 'bg-success-soft text-success',
    wait: 'bg-warning-soft text-warning',
    bad: 'bg-red-50 text-red-700',
    neutral: 'bg-muted text-foreground',
  }[tone];
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-xl p-4', styles)}>
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="space-y-2 text-sm">
        <p className="text-base font-bold">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Qué le decimos al cliente según en qué etapa está su pedido ya pagado. */
function progressMessage(order: Order): { title: string; text: string } {
  const pickup = order.deliveryMethod === 'PICKUP';
  switch (order.status) {
    case 'IN_PREPARATION':
      return { title: 'Estamos preparando tu pedido', text: `En ${order.branch.name} lo están armando. Te avisamos cuando esté listo.` };
    case 'READY_FOR_PICKUP':
      return { title: '¡Tu pedido está listo para retirar!', text: `Pasá por ${order.branch.name} (${order.branch.address}) con tu número de pedido.` };
    case 'READY_FOR_FREIGHT':
      return { title: 'Tu pedido está listo para el envío', text: 'Ya está armado y esperando al flete. Te avisamos cuando salga.' };
    case 'COMPLETED':
      return { title: pickup ? 'Pedido retirado' : 'Pedido despachado', text: '¡Gracias por tu compra!' };
    default:
      return {
        title: '¡Pago aprobado!',
        text: pickup
          ? `Te avisamos cuando tu pedido esté listo para retirar en ${order.branch.name}.`
          : 'Coordinamos el envío con la sucursal y te avisamos.',
      };
  }
}

/** Seguimiento del pedido: por qué etapas pasó y cuándo. */
function Timeline({ history }: { history: Order['history'] }) {
  const steps = history.filter((event) => event.status !== 'PENDING_PAYMENT');
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="timeline-title" className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-black/5">
      <h2 id="timeline-title" className="font-bold">
        Seguimiento
      </h2>
      <ol className="space-y-2 border-l-2 border-brand-soft pl-4 text-sm" data-testid="timeline">
        {steps.map((event, index) => (
          <li key={`${event.status}-${index}`} className="relative">
            <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand" />
            <span className="font-medium">{ORDER_STATUS_LABEL[event.status]}</span>
            <span className="block text-xs text-muted-foreground">
              {new Date(event.at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PaymentBanner({ order, confirming, onCancel, cancelling }: { order: Order; confirming: boolean; onCancel: () => void; cancelling: boolean }) {
  const countdown = useCountdown(order.status === 'PENDING_PAYMENT' ? order.expiresAt : null);

  if (order.status === 'CANCELLED') {
    return (
      <Banner tone="neutral" icon={XCircleIcon} title="Pedido cancelado">
        <p>{CANCEL_REASON_TEXT[order.cancelReason ?? ''] ?? 'Este pedido ya no está activo.'}</p>
        {order.needsReview && <p className="font-semibold">Si pagaste igualmente, nos vamos a comunicar para devolverte el dinero.</p>}
        <Link href="/productos" className="font-semibold underline">
          Seguir comprando
        </Link>
      </Banner>
    );
  }

  if (order.status !== 'PENDING_PAYMENT') {
    const { title, text } = progressMessage(order);
    return (
      <Banner tone="ok" icon={CheckCircle2Icon} title={title}>
        <p>{text}</p>
      </Banner>
    );
  }

  if (confirming) {
    return (
      <Banner tone="wait" icon={Loader2Icon} title="Estamos confirmando tu pago…">
        <p>Mercado Pago nos avisa en unos segundos. No cierres esta página.</p>
      </Banner>
    );
  }

  return (
    <Banner tone="wait" icon={ClockIcon} title={countdown ? 'Falta completar el pago' : 'El plazo para pagar está por vencer'}>
      {order.paymentStatus === 'rejected' && <p className="font-semibold">El pago fue rechazado. Podés intentar con otro medio de pago.</p>}
      {order.needsReview && <p className="font-semibold">Estamos revisando tu pago. Te contactamos si hace falta algo.</p>}
      <p>
        Reservamos tu stock{countdown ? <> por <strong data-testid="countdown">{countdown}</strong> más</> : ''}. Después se libera.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {order.checkoutUrl && (
          <a href={order.checkoutUrl} className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
            Pagar ahora
          </a>
        )}
        <Button type="button" variant="outline" size="lg" className="h-10" disabled={cancelling} onClick={onCancel}>
          Cancelar pedido
        </Button>
      </div>
    </Banner>
  );
}

function Delivery({ order }: { order: Order }) {
  const Icon = order.deliveryMethod === 'PICKUP' ? StoreIcon : TruckIcon;
  return (
    <section aria-labelledby="delivery-title" className="space-y-1 rounded-xl bg-white p-5 text-sm ring-1 ring-black/5">
      <h2 id="delivery-title" className="flex items-center gap-2 font-bold">
        <Icon className="size-4 text-brand" aria-hidden />
        {order.deliveryMethod === 'PICKUP' ? 'Retiro en sucursal' : 'Envío a domicilio'}
      </h2>
      <p className="font-medium">{order.branch.name}</p>
      <p className="text-muted-foreground">{order.branch.address}</p>
      {order.shippingAddress && <p className="pt-1">Entrega en: {order.shippingAddress}</p>}
      {order.note && <p className="pt-1 text-muted-foreground">Nota: {order.note}</p>}
    </section>
  );
}

interface OrderStatusPanelProps {
  orderId: string;
  /** El cliente acaba de volver de Mercado Pago (la URL trae los datos del pago). */
  returning: boolean;
  /** Número de pago informado en la URL: solo orienta la verificación, que se hace contra Mercado Pago. */
  paymentId?: string;
}

export function OrderStatusPanel({ orderId, returning, paymentId }: OrderStatusPanelProps) {
  const gate = useCustomerGate();
  const [gaveUp, setGaveUp] = useState(false);
  const sync = useSyncOrder(orderId);
  const cancel = useCancelOrder(orderId);

  // Se espera la confirmación mientras el pago no tenga un resultado final negativo: uno rechazado o cancelado se
  // muestra enseguida (con la opción de reintentar) en vez de dejar al cliente mirando un "confirmando…".
  const waiting = (order: Order) => returning && !gaveUp && order.status === 'PENDING_PAYMENT' && !FINAL_FAILURES.has(order.paymentStatus ?? '');
  const { data: order, isPending, isError, error } = useOrder(orderId, waiting);

  useEffect(() => {
    if (!returning) return;
    const timer = setTimeout(() => setGaveUp(true), WAIT_FOR_CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [returning]);

  // Mientras se espera la confirmación, se le pide al servidor que verifique el pago con Mercado Pago:
  // así el pedido avanza aunque el aviso (webhook) demore o no pueda llegar (p. ej. en una PC local).
  const confirming = Boolean(order && waiting(order));
  const { mutate: verify } = sync;
  useEffect(() => {
    if (!confirming) return;
    verify(paymentId);
    const timer = setInterval(() => verify(paymentId), SYNC_EVERY_MS);
    return () => clearInterval(timer);
  }, [confirming, paymentId, verify]);

  if (gate === 'signedOut') return <SignedOutNotice returnTo={`/pedidos/${orderId}`} what="tu pedido" />;
  if (gate === 'loading' || isPending) return <Skeleton className="h-72" />;
  if (isError || !order) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-white p-8 text-center ring-1 ring-black/5">
        <p className="font-semibold">{error instanceof ApiError && error.status === 404 ? 'No encontramos ese pedido.' : 'No pudimos cargar el pedido.'}</p>
        <Link href="/pedidos" className="text-sm font-semibold text-brand underline underline-offset-4">
          Ver mis pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Pedido #{order.number}</h1>
        <span data-testid="order-status" className={cn('rounded-full px-3 py-1 text-sm font-semibold', ORDER_STATUS_TONE[order.status])}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      <PaymentBanner
        order={order}
        confirming={confirming}
        cancelling={cancel.isPending}
        onCancel={() => cancel.mutate(undefined, { onError: () => toast.error('No se pudo cancelar el pedido') })}
      />

      <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
        <OrderSummary order={order} />
        <div className="space-y-5">
          <Delivery order={order} />
          <Timeline history={order.history} />
        </div>
      </div>
    </div>
  );
}
