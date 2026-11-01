'use client';

import { Loader2Icon, MapPinIcon, PackageIcon, PhoneIcon, StoreIcon, TruckIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { ApiError } from '@/lib/api';
import { StaffOrder, StaffOrderStatus, STATUS_LABEL, backLabel, forwardLabel, useTransition } from '@/lib/sala-api';
import { useOperatingBranch } from './branch-context';

const formatTime = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const HISTORY_LABEL: Record<string, string> = { ...STATUS_LABEL, PENDING_PAYMENT: 'Pedido creado', CANCELLED: 'Cancelado' };

/** Detalle de un pedido: qué preparar, para quién y cómo contactarlo, con las acciones del estado actual. */
export function OrderDialog({ order, onClose }: { order: StaffOrder | null; onClose: () => void }) {
  const transition = useTransition(useOperatingBranch());

  function move(status: StaffOrderStatus, order: StaffOrder) {
    transition.mutate(
      { orderId: order.id, status },
      {
        onSuccess: () => {
          toast.success(`Pedido #${order.number}: ${STATUS_LABEL[status]}`);
          if (status === 'COMPLETED') onClose();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado'),
      },
    );
  }

  return (
    <ModalDialog open={order !== null} onClose={onClose} labelledBy="order-dialog-title">
      {order && (
        <div className="space-y-5 p-5">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h2 id="order-dialog-title" className="text-2xl font-extrabold">
                Pedido #{order.number}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {order.deliveryMethod === 'PICKUP' ? <StoreIcon className="size-4" aria-hidden /> : <TruckIcon className="size-4" aria-hidden />}
                {order.deliveryMethod === 'PICKUP' ? 'Retira en el mostrador' : 'Envío (flete)'} · <strong>{STATUS_LABEL[order.status]}</strong>
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Cerrar" onClick={onClose}>
              <XIcon />
            </Button>
          </header>

          <section aria-label="Cliente" className="space-y-1 rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-semibold">{order.customer.businessName ?? order.customer.name}</p>
            {order.customer.businessName && <p className="text-muted-foreground">{order.customer.name}</p>}
            {order.customer.phone && (
              <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1.5 font-medium text-brand">
                <PhoneIcon className="size-4" aria-hidden /> {order.customer.phone}
              </a>
            )}
            {order.shippingAddress && (
              <p className="flex items-start gap-1.5">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {order.shippingAddress}
              </p>
            )}
          </section>

          {order.note && (
            <p role="note" className="rounded-xl bg-warning-soft p-3 text-sm font-medium text-warning">
              Nota del cliente: {order.note}
            </p>
          )}

          <section aria-label="Productos a preparar">
            <h3 className="mb-2 text-sm font-bold">A preparar · {order.units} {order.units === 1 ? 'unidad' : 'unidades'}</h3>
            <ul className="divide-y rounded-xl ring-1 ring-black/10">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 p-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- variante WebP ya dimensionada por el backend
                      <img src={item.image.thumb} alt="" width={200} height={200} className="size-full object-cover" />
                    ) : (
                      <PackageIcon className="m-auto mt-3 size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{item.barcode ?? item.sku}</p>
                  </div>
                  <p className="shrink-0 text-xl font-extrabold" aria-label={`${item.quantity} unidades`}>
                    × {item.quantity}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Historial">
            <h3 className="mb-2 text-sm font-bold">Historial</h3>
            <ol className="space-y-1 text-xs text-muted-foreground">
              {order.history.map((event, index) => (
                <li key={`${event.status}-${index}`}>
                  <span className="font-medium text-foreground">{HISTORY_LABEL[event.status] ?? event.status}</span> · {formatTime(event.at)}
                </li>
              ))}
            </ol>
          </section>

          <footer className="flex flex-col gap-2 sm:flex-row-reverse">
            {order.actions.forward && (
              <Button
                type="button"
                size="lg"
                className="h-12 flex-1 bg-brand text-base text-white hover:bg-brand-dark"
                disabled={transition.isPending}
                onClick={() => move(order.actions.forward!, order)}
              >
                {transition.isPending && <Loader2Icon className="animate-spin" />}
                {forwardLabel(order.actions.forward, order.deliveryMethod)}
              </Button>
            )}
            {order.actions.back && (
              <Button type="button" variant="outline" size="lg" className="h-12" disabled={transition.isPending} onClick={() => move(order.actions.back!, order)}>
                {backLabel(order.actions.back)}
              </Button>
            )}
          </footer>
        </div>
      )}
    </ModalDialog>
  );
}
