'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBranches } from '@/lib/backoffice/administration';
import { Overview, PeriodTotals, PipelineStatus, Rank, useLowStock, useOverview } from '@/lib/backoffice/analytics';
import { formatMoney } from '@/lib/money';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Panel, formatDay } from './common';
import { SalesChart } from './sales-chart';

const PRESETS = [
  { value: '1', label: 'Hoy' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'custom', label: 'Elegir fechas' },
] as const;

const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  PENDING: 'Pendientes',
  IN_PREPARATION: 'En preparación',
  READY_FOR_PICKUP: 'Para retirar',
  READY_FOR_FREIGHT: 'Para flete',
};

const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
};

/** Variación porcentual contra el período anterior; `null` si no hay con qué comparar. */
function change(current: string | number, previous: string | number): number | null {
  const base = Number(previous);
  return base > 0 ? ((Number(current) - base) / base) * 100 : null;
}

function Kpi({ label, value, delta, hint, testId }: { label: string; value: string; delta?: number | null; hint?: string; testId: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p data-testid={testId} className="mt-1 text-2xl font-extrabold tracking-tight">
        {value}
      </p>
      <p className={cn('mt-1 text-xs', delta === undefined || delta === null ? 'text-muted-foreground' : delta >= 0 ? 'text-success' : 'text-red-600')}>
        {delta === undefined ? (hint ?? ' ') : delta === null ? 'Sin datos del período anterior' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% vs. período anterior`}
      </p>
    </div>
  );
}

function Totals({ totals, previous }: { totals: PeriodTotals; previous: PeriodTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Kpi testId="kpi-revenue" label="Ventas" value={formatMoney(totals.revenue)} delta={change(totals.revenue, previous.revenue)} />
      <Kpi testId="kpi-orders" label="Pedidos pagados" value={String(totals.orders)} delta={change(totals.orders, previous.orders)} />
      <Kpi testId="kpi-ticket" label="Ticket promedio" value={formatMoney(totals.averageTicket)} delta={change(totals.averageTicket, previous.averageTicket)} />
      <Kpi testId="kpi-units" label="Unidades vendidas" value={String(totals.units)} delta={change(totals.units, previous.units)} />
      <Kpi testId="kpi-discounts" label="Descuentos otorgados" value={formatMoney(totals.discounts)} hint="Por promociones" />
      <Kpi testId="kpi-margin" label="Margen estimado" value={formatMoney(totals.estimatedMargin)} hint="Con el costo actual de cada producto" />
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Overview['byDelivery'] }) {
  const total = rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin ventas.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{row.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatMoney(row.revenue)} · {row.orders} {row.orders === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${total > 0 ? (Number(row.revenue) / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TopProducts({ rows, rank, onRank }: { rows: Overview['topProducts']; rank: Rank; onRank: (rank: Rank) => void }) {
  return (
    <Panel
      title="Más vendidos"
      description="Los 10 productos que más pesaron en el período."
      className="lg:col-span-2"
    >
      <div role="tablist" aria-label="Ordenar por" className="mb-3 inline-flex rounded-lg bg-muted p-1 text-sm">
        {([['revenue', 'Por ingresos'], ['units', 'Por unidades']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={rank === value} onClick={() => onRank(value)} className={cn('rounded-md px-3 py-1 font-medium', rank === value && 'bg-white shadow-sm')}>
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
      ) : (
        <ol className="divide-y text-sm" data-testid="top-products">
          {rows.map((row, index) => (
            <li key={row.productId} className="flex items-center gap-3 py-2">
              <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.sku}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold">{formatMoney(row.revenue)}</span>
                <span className="text-xs text-muted-foreground">{row.units} u.</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function LowStock({ branchId }: { branchId: string | undefined }) {
  const low = useLowStock(branchId, 5);
  return (
    <Panel title="Stock bajo" description="Disponible (físico menos reservado) de 5 unidades o menos.">
      {low.isPending ? (
        <Skeleton className="h-24" />
      ) : low.isError ? (
        <LoadError />
      ) : low.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada con poco stock.</p>
      ) : (
        <ul className="divide-y text-sm" data-testid="low-stock">
          {low.data.map((row) => (
            <li key={`${row.branch.id}-${row.product.id}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.product.name}</span>
                <span className="text-xs text-muted-foreground">{row.branch.name}</span>
              </span>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', row.available === 0 ? 'bg-red-100 text-red-700' : 'bg-warning-soft text-warning')}>
                {row.available === 0 ? 'Sin stock' : `${row.available} disp.`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Dashboard() {
  const { data: profile } = useSession();
  const isSuperadmin = profile?.role === 'SUPERADMIN';
  const branches = useAdminBranches(isSuperadmin);

  const [preset, setPreset] = useState<string>('30');
  const [custom, setCustom] = useState({ from: daysAgo(29), to: isoDay(new Date()) });
  const [branchId, setBranchId] = useState('');
  const [rank, setRank] = useState<Rank>('revenue');

  const range = preset === 'custom' ? custom : { from: daysAgo(Number(preset) - 1), to: undefined };
  const overview = useOverview({ ...range, rank, branchId: branchId || undefined });
  const data = overview.data;
  const selectedBranch = branchId || undefined;
  const scopeLabel = isSuperadmin ? (branches.data?.find((branch) => branch.id === branchId)?.name ?? 'todas las sucursales') : (profile?.branchName ?? '');

  return (
    <>
      <PageHeader
        title="Resumen de ventas"
        description={data ? `Del ${formatDay(`${data.range.from}T12:00:00`)} al ${formatDay(`${data.range.to}T12:00:00`)} · ${scopeLabel}` : 'Cargando…'}
        actions={
          <>
            {isSuperadmin && (
              <NativeSelect aria-label="Sucursal" className="h-10 w-52 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Todas las sucursales</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect aria-label="Período" className="h-10 w-44 text-sm" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </>
        }
      />

      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Desde
            <Input type="date" className="mt-1 h-10 w-44" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          </label>
          <label className="text-sm font-medium">
            Hasta
            <Input type="date" className="mt-1 h-10 w-44" value={custom.to} min={custom.from} max={isoDay(new Date())} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </label>
        </div>
      )}

      {overview.isPending ? (
        <ListSkeleton rows={4} />
      ) : overview.isError || !data ? (
        <LoadError>{overview.error instanceof Error ? overview.error.message : 'No se pudo cargar el resumen.'}</LoadError>
      ) : (
        <div className={cn('space-y-6', overview.isPlaceholderData && 'opacity-60')}>
          <Totals totals={data.totals} previous={data.previous} />

          {data.totals.orders === 0 ? (
            <EmptyState>No hay ventas pagadas en este período.</EmptyState>
          ) : (
            <Panel title="Ventas por día">
              <SalesChart series={data.series} />
            </Panel>
          )}

          <Panel title="En la cola de sala ahora" description="Pedidos pagados que todavía no se entregaron.">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(PIPELINE_LABEL) as PipelineStatus[]).map((status) => (
                <li key={status} className="rounded-lg bg-muted/60 p-3">
                  <p className="text-2xl font-extrabold" data-testid={`pipeline-${status}`}>
                    {data.pipeline[status] ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{PIPELINE_LABEL[status]}</p>
                </li>
              ))}
            </ul>
            <Link href="/sala" className="mt-3 inline-block text-sm font-medium text-brand">
              Abrir el panel de sala →
            </Link>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <TopProducts rows={data.topProducts} rank={rank} onRank={setRank} />
            <div className="space-y-6">
              <Breakdown title="Por forma de entrega" rows={data.byDelivery} />
              <Breakdown title="Por tipo de cliente" rows={data.byCustomerType} />
              {data.byBranch && <Breakdown title="Por sucursal" rows={data.byBranch} />}
            </div>
          </div>

          <LowStock branchId={selectedBranch} />
        </div>
      )}
    </>
  );
}
