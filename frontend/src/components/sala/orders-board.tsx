'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks';
import { formatPrice } from '@/lib/money';
import { QUEUE_LIMIT, StaffOrder, StaffOrderStatus, STATUS_LABEL, useDelivered, useQueue, useTransition } from '@/lib/sala-api';
import { cn } from '@/lib/utils';
import { useOperatingBranch } from './branch-context';
import { OrderCard } from './order-card';
import { OrderDialog } from './order-dialog';
import { useNow } from './use-now';

const COLUMNS = ['PENDING', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'READY_FOR_FREIGHT'] as const satisfies readonly StaffOrderStatus[];
type Column = (typeof COLUMNS)[number];

const COLUMN_HELP: Record<Column, string> = {
  PENDING: 'Pagados, esperando que alguien los prepare',
  IN_PREPARATION: 'Alguien los está armando',
  READY_FOR_PICKUP: 'Esperando que el cliente pase a retirar',
  READY_FOR_FREIGHT: 'Esperando al flete (B2B)',
};

/** Avisa cuando llega un pedido nuevo y deja la cantidad pendiente en el título de la pestaña. */
function useNewOrderAlerts(orders: StaffOrder[] | undefined) {
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!orders) return;
    const pending = orders.filter((order) => order.status === 'PENDING');
    document.title = `${pending.length > 0 ? `(${pending.length}) ` : ''}Pedidos · Sala`;

    const ids = new Set(pending.map((order) => order.id));
    if (known.current) {
      const fresh = pending.filter((order) => !known.current!.has(order.id));
      if (fresh.length > 0) toast.info(fresh.length === 1 ? `Llegó un pedido nuevo: #${fresh[0].number}` : `Llegaron ${fresh.length} pedidos nuevos`);
    }
    known.current = ids; // el primer vistazo no avisa: no son "nuevos", solo los que ya estaban
  }, [orders]);
}

function Delivered({ search }: { search: string }) {
  const branchId = useOperatingBranch();
  const [page, setPage] = useState(1);
  const { data, isPending, isPlaceholderData } = useDelivered(branchId, search, page);

  if (isPending) return <Skeleton className="h-40" />;
  if (!data || data.items.length === 0) return <p className="rounded-xl bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-black/5">Todavía no hay pedidos entregados.</p>;

  const totalPages = Math.ceil(data.total / data.limit);
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="delivered-list">
        {data.items.map((order) => (
          <li key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="min-w-0">
              <span className="font-bold">#{order.number}</span> · {order.customer.businessName ?? order.customer.name}
              <span className="block text-xs text-muted-foreground">
                {order.units} {order.units === 1 ? 'unidad' : 'unidades'} · {order.deliveryMethod === 'PICKUP' ? 'Retiro' : 'Envío'}
              </span>
            </span>
            <span className="shrink-0 font-semibold">{formatPrice(order.total)}</span>
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

export function OrdersBoard() {
  const branchId = useOperatingBranch();
  const now = useNow();
  const [view, setView] = useState<'active' | 'done'>('active');
  const [column, setColumn] = useState<Column>('PENDING'); // solo se usa en pantallas chicas
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [openId, setOpenId] = useState<string | null>(null);

  const queue = useQueue(branchId, search);
  const transition = useTransition(branchId);
  const orders = queue.data?.items;
  useNewOrderAlerts(search ? undefined : orders); // con un filtro puesto la lista no es "toda la cola"

  const byColumn = (status: Column) => (orders ?? []).filter((order) => order.status === status);
  const open = orders?.find((order) => order.id === openId) ?? null;

  function advance(order: StaffOrder) {
    if (!order.actions.forward) return;
    transition.mutate(
      { orderId: order.id, status: order.actions.forward },
      {
        onSuccess: () => toast.success(`Pedido #${order.number}: ${STATUS_LABEL[order.actions.forward!]}`),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado'),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-lg bg-muted p-1">
          {([['active', 'En curso'], ['done', 'Entregados']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn('rounded-md px-4 py-1.5 text-sm font-medium', view === value && 'bg-white shadow-sm')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Buscar pedido" placeholder="N.º de pedido o cliente" className="h-10 pl-9" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      {view === 'done' ? (
        <Delivered search={search} />
      ) : queue.isPending ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((status) => (
            <Skeleton key={status} className="h-56" />
          ))}
        </div>
      ) : queue.isError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
          No se pudo cargar la cola de pedidos. Se reintenta sola.
        </p>
      ) : (
        <>
          {queue.data.total > queue.data.items.length && (
            <p role="alert" className="rounded-xl bg-warning-soft p-3 text-sm font-medium text-warning">
              Hay {queue.data.total} pedidos en curso y se muestran los {QUEUE_LIMIT} más antiguos. Terminá los de arriba para ver el resto.
            </p>
          )}
          <div role="tablist" aria-label="Etapa" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 lg:hidden">
            {COLUMNS.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={column === status}
                onClick={() => setColumn(status)}
                className={cn('rounded-md px-1 py-1.5 text-center text-[11px] font-medium leading-tight', column === status && 'bg-white shadow-sm')}
              >
                {STATUS_LABEL[status]}
                <span className="block text-base font-extrabold">{byColumn(status).length}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {COLUMNS.map((status) => (
              <section
                key={status}
                aria-label={STATUS_LABEL[status]}
                data-column={status}
                className={cn('space-y-3', column !== status && 'hidden lg:block')}
              >
                <header className="hidden lg:block">
                  <h2 className="flex items-center justify-between text-sm font-bold">
                    {STATUS_LABEL[status]}
                    <span data-testid={`count-${status}`} className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">
                      {byColumn(status).length}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">{COLUMN_HELP[status]}</p>
                </header>
                <ul className="space-y-3">
                  {byColumn(status).map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      now={now}
                      busy={transition.isPending && transition.variables?.orderId === order.id}
                      onOpen={() => setOpenId(order.id)}
                      onAdvance={() => advance(order)}
                    />
                  ))}
                </ul>
                {byColumn(status).length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">Nada por acá</p>}
              </section>
            ))}
          </div>
        </>
      )}

      <OrderDialog order={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
