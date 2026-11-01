'use client';

import { RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GatewayView, useGatewayEvents } from '@/lib/admin-payments';
import { CopyButton } from './copy-button';

const NOTIFICATIONS_URL = 'https://www.mercadopago.com.ar/developers/panel/app';

const formatDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' });

export function WebhookPanel({ view }: { view: GatewayView }) {
  const events = useGatewayEvents();
  const isLocal = /localhost|127\.0\.0\.1/.test(view.webhookUrl);

  return (
    <section aria-labelledby="webhook-title" className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-black/5">
      <div className="space-y-1">
        <h2 id="webhook-title" className="text-base font-bold">
          Webhook (avisos de pago)
        </h2>
        <p className="text-sm text-muted-foreground">Mercado Pago avisa a esta dirección cada vez que cambia el estado de un pago.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
        <code className="min-w-0 flex-1 break-all text-sm" data-testid="webhook-url">
          {view.webhookUrl}
        </code>
        <CopyButton value={view.webhookUrl} />
      </div>

      {isLocal && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          Esta dirección es local: Mercado Pago no puede llegar a ella. En producción se usa la URL pública del sitio (variable <code>PUBLIC_API_URL</code>); para probar
          en tu computadora podés exponerla con un túnel (p. ej. Cloudflare Tunnel).
        </p>
      )}

      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>
          Entrá a{' '}
          <a href={NOTIFICATIONS_URL} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-4 hover:underline">
            Tus integraciones
          </a>{' '}
          → tu aplicación → <strong>Webhooks</strong> → <strong>Configurar notificaciones</strong>.
        </li>
        <li>
          En <strong>URL de producción</strong> (y en la de pruebas, si usás modo prueba) pegá la dirección de arriba.
        </li>
        <li>
          Marcá el evento <strong>Pagos</strong> y guardá.
        </li>
        <li>
          Copiá la <strong>clave secreta</strong> que genera y pegala en «Clave secreta del webhook» (arriba).
        </li>
        <li>
          Usá <strong>Simular notificación</strong> en Mercado Pago: el aviso debe aparecer abajo.
        </li>
      </ol>

      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Últimos avisos recibidos</h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => events.refetch()} disabled={events.isFetching} aria-label="Actualizar avisos">
            <RefreshCwIcon className={events.isFetching ? 'animate-spin' : undefined} />
          </Button>
        </div>
        {events.isPending ? (
          <Skeleton className="h-16" />
        ) : events.data && events.data.length > 0 ? (
          <ul className="divide-y rounded-lg ring-1 ring-black/5" data-testid="webhook-events">
            {events.data.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{event.action ?? event.topic}</span>{' '}
                  <span className="text-muted-foreground">· recurso {event.resourceId}</span>
                  {event.liveMode === false && <span className="ml-2 rounded bg-warning-soft px-1.5 py-0.5 text-xs text-warning">prueba</span>}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={event.receivedAt}>
                  {formatDate(event.receivedAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no llegó ningún aviso con firma válida.</p>
        )}
      </div>
    </section>
  );
}
