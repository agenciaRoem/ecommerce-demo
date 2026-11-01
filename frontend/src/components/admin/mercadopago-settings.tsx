'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useGateway } from '@/lib/admin-payments';
import { GatewayForm } from './gateway-form';
import { GatewayStatus } from './gateway-status';
import { WebhookPanel } from './webhook-panel';

/** Pantalla del backoffice para conectar Mercado Pago sin tocar código ni variables de entorno. */
export function MercadoPagoSettings() {
  const gateway = useGateway();

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">Conectá tu cuenta para cobrar los pedidos de la tienda.</p>
      </div>

      {gateway.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-96" />
        </div>
      )}

      {gateway.isError && (
        <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-5 text-sm text-red-700">
          <p>No se pudo cargar la configuración de pagos.</p>
          <Button variant="outline" size="sm" onClick={() => gateway.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {gateway.data && (
        <>
          <GatewayStatus view={gateway.data} />
          {/* La key reinicia el formulario cuando el servidor devuelve una versión nueva de la configuración. */}
          <GatewayForm key={gateway.data.updatedAt ?? 'nuevo'} view={gateway.data} />
          <WebhookPanel view={gateway.data} />
        </>
      )}
    </>
  );
}
