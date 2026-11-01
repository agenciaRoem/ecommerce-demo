'use client';

import { AlertTriangleIcon, CheckCircle2Icon, CircleIcon, Loader2Icon, PauseCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GatewayView,
  useDisconnectGateway,
  useGatewayEvents,
  useSaveGateway,
  useVerifyGateway,
} from '@/lib/admin-payments';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ConfirmButton } from './confirm-button';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

function statusOf(view: GatewayView): { label: string; tone: string } {
  if (!view.hasAccessToken) return { label: 'Sin configurar', tone: 'bg-muted text-muted-foreground' };
  if (view.lastError) return { label: 'Con problemas', tone: 'bg-red-100 text-red-700' };
  if (view.isEnabled && view.mode === 'PRODUCTION') return { label: 'Cobrando (producción)', tone: 'bg-success-soft text-success' };
  if (view.isEnabled) return { label: 'Activa en modo prueba', tone: 'bg-warning-soft text-warning' };
  return { label: 'Conectada, cobros pausados', tone: 'bg-brand-soft text-brand' };
}

function Requirement({ done, children }: { done: boolean; children: React.ReactNode }) {
  const Icon = done ? CheckCircle2Icon : CircleIcon;
  return (
    <li className={cn('flex items-start gap-2 text-sm', done ? 'text-foreground' : 'text-muted-foreground')}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', done && 'text-success')} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function GatewayStatus({ view }: { view: GatewayView }) {
  const verify = useVerifyGateway();
  const save = useSaveGateway();
  const disconnect = useDisconnectGateway();
  const events = useGatewayEvents();
  const status = statusOf(view);

  const credentialsValid = view.hasAccessToken && Boolean(view.lastVerifiedAt) && !view.lastError;
  const canEnable = credentialsValid && view.hasWebhookSecret;
  const receivedNotice = (events.data?.length ?? 0) > 0;

  function toggleEnabled(enable: boolean) {
    save.mutate(
      { isEnabled: enable },
      {
        onSuccess: () => toast.success(enable ? 'Cobros activados' : 'Cobros pausados'),
        onError: (error) => toast.error(errorMessage(error, 'No se pudo cambiar el estado')),
      },
    );
  }

  return (
    <section aria-labelledby="status-title" className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="status-title" className="text-base font-bold">
          Estado
        </h2>
        <Badge className={cn('text-sm', status.tone)}>{status.label}</Badge>
      </div>

      {view.lastError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {view.lastError}
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Cuenta vinculada</dt>
          <dd className="font-medium">{view.account ? `${view.account.label} (${view.account.id})` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">País / sitio</dt>
          <dd className="font-medium">{view.account?.siteId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Modo</dt>
          <dd className="font-medium">{view.mode === 'PRODUCTION' ? 'Producción (cobros reales)' : 'Pruebas (sin dinero real)'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Última validación</dt>
          <dd className="font-medium">{formatDate(view.lastVerifiedAt)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!view.hasAccessToken || verify.isPending}
          onClick={() =>
            verify.mutate(undefined, {
              onSuccess: ({ ok }) => (ok ? toast.success('Conexión correcta con Mercado Pago') : toast.error('No se pudo validar la conexión')),
              onError: (error) => toast.error(errorMessage(error, 'No se pudo probar la conexión')),
            })
          }
        >
          {verify.isPending && <Loader2Icon className="animate-spin" />}
          Probar conexión
        </Button>
        <ConfirmButton
          type="button"
          variant="outline"
          confirmLabel="¿Seguro? Borra las credenciales"
          disabled={!view.hasAccessToken || disconnect.isPending}
          onConfirm={() =>
            disconnect.mutate(undefined, {
              onSuccess: () => toast.success('Mercado Pago desconectado'),
              onError: (error) => toast.error(errorMessage(error, 'No se pudo desconectar')),
            })
          }
        >
          Desconectar
        </ConfirmButton>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-bold">Activar los cobros en la tienda</h3>
        <ul className="space-y-1.5">
          <Requirement done={credentialsValid}>Access Token cargado y validado con Mercado Pago</Requirement>
          <Requirement done={view.hasWebhookSecret}>Clave secreta del webhook cargada (confirma los pagos)</Requirement>
          <Requirement done={receivedNotice}>Aviso recibido desde Mercado Pago (opcional: prueba que el webhook funciona)</Requirement>
        </ul>

        {view.isEnabled ? (
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => toggleEnabled(false)}>
            <PauseCircleIcon /> Pausar cobros
          </Button>
        ) : view.mode === 'PRODUCTION' ? (
          <ConfirmButton
            type="button"
            className="bg-success text-white hover:bg-success/90"
            confirmLabel="¿Seguro? Se cobrará dinero real"
            disabled={!canEnable || save.isPending}
            onConfirm={() => toggleEnabled(true)}
          >
            Activar cobros reales
          </ConfirmButton>
        ) : (
          <Button type="button" className="bg-brand text-white hover:bg-brand-dark" disabled={!canEnable || save.isPending} onClick={() => toggleEnabled(true)}>
            {save.isPending && <Loader2Icon className="animate-spin" />}
            Activar en modo prueba
          </Button>
        )}
      </div>
    </section>
  );
}
