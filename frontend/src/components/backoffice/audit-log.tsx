'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { AuditEntry, AuditFilters, useAudit, useAuditFacets } from '@/lib/backoffice/administration';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Pager, SuperadminOnly, formatDateTime } from './common';

/** Nombres legibles de las acciones que el sistema registra. Las que no figuran se muestran tal cual. */
const ACTION_LABEL: Record<string, string> = {
  'staff.created': 'Alta de personal',
  'staff.updated': 'Cambio de personal',
  'staff.deactivated': 'Baja de personal',
  'staff.reactivated': 'Reactivación de personal',
  'staff.password_reset': 'Contraseña restablecida',
  'branch.created': 'Alta de sucursal',
  'branch.updated': 'Cambio de sucursal',
  'branch.deactivated': 'Baja de sucursal',
  'branch.activated': 'Reactivación de sucursal',
  'product.price_updated': 'Cambio de precio',
  'product.prices_bulk_updated': 'Cambio masivo de precios',
  'promotion.created': 'Promoción creada',
  'promotion.updated': 'Promoción editada',
  'customer.cuit_verified': 'CUIT aprobado',
  'customer.cuit_revoked': 'CUIT revocado',
  'order.payment_issue': 'Aviso de pago',
  'order.payment_issue_resolved': 'Aviso de pago resuelto',
};

const labelOf = (action: string) => ACTION_LABEL[action] ?? action;

function Entry({ entry }: { entry: AuditEntry }) {
  const hasDetail = entry.metadata !== null && typeof entry.metadata === 'object' && Object.keys(entry.metadata as object).length > 0;
  return (
    <li className="space-y-1 p-3 text-sm" data-testid="audit-item">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {labelOf(entry.action)} <span className="font-mono text-xs font-normal text-muted-foreground">{entry.action}</span>
        </p>
        <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {entry.actor ? `${entry.actor.fullName} (${entry.actor.email})` : 'Sistema'} · {entry.entity}
        {entry.entityId && <span className="font-mono"> {entry.entityId.slice(0, 8)}</span>}
        {entry.ip && ` · ${entry.ip}`}
      </p>
      {hasDetail && (
        <details className="text-xs">
          <summary className="cursor-pointer text-brand">Ver detalle</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-2">{JSON.stringify(entry.metadata, null, 2)}</pre>
        </details>
      )}
    </li>
  );
}

export function AuditLog() {
  const facets = useAuditFacets();
  const [filters, setFilters] = useState<Omit<AuditFilters, 'page'>>({ entity: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const audit = useAudit({ ...filters, page });

  const filter = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };

  return (
    <SuperadminOnly>
      <PageHeader title="Auditoría" description="Registro de las acciones sensibles: quién hizo qué y cuándo. No se puede editar ni borrar. Nunca guarda contraseñas ni credenciales." />

      <div className="flex flex-wrap items-end gap-3">
        <NativeSelect aria-label="Sección" className="h-10 w-44 text-sm" value={filters.entity} onChange={(e) => filter({ entity: e.target.value })}>
          <option value="">Todas las secciones</option>
          {facets.data?.entities.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Acción" className="h-10 w-60 text-sm" value={filters.action} onChange={(e) => filter({ action: e.target.value })}>
          <option value="">Todas las acciones</option>
          {facets.data?.actions.map((action) => (
            <option key={action} value={action}>
              {labelOf(action)}
            </option>
          ))}
        </NativeSelect>
        <label className="text-xs font-medium">
          Desde
          <Input type="date" className="mt-1 h-10 w-40" value={filters.from} max={filters.to || undefined} onChange={(e) => filter({ from: e.target.value })} />
        </label>
        <label className="text-xs font-medium">
          Hasta
          <Input type="date" className="mt-1 h-10 w-40" value={filters.to} min={filters.from || undefined} onChange={(e) => filter({ to: e.target.value })} />
        </label>
      </div>

      {audit.isPending ? (
        <ListSkeleton />
      ) : audit.isError ? (
        <LoadError />
      ) : audit.data.items.length === 0 ? (
        <EmptyState>No hay registros con esos filtros.</EmptyState>
      ) : (
        <div className={cn('space-y-2', audit.isPlaceholderData && 'opacity-60')}>
          <p className="text-sm text-muted-foreground">{audit.data.total} registros, del más reciente al más antiguo.</p>
          <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="audit-list">
            {audit.data.items.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
          <Pager page={page} limit={audit.data.limit} total={audit.data.total} onPage={setPage} disabled={audit.isPlaceholderData} />
        </div>
      )}
    </SuperadminOnly>
  );
}
