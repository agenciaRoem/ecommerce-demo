'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AUDIENCE_LABEL, Promotion, PromotionState, STATE_LABEL, usePromotions } from '@/lib/backoffice/promotions';
import { formatMoney } from '@/lib/money';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Pager, Pill, formatDateTime } from '../common';
import { PromotionDialog } from './promotion-dialog';

const FILTERS: (PromotionState | 'all')[] = ['all', 'active', 'upcoming', 'ended', 'inactive'];
const TONE = { active: 'ok', upcoming: 'info', ended: 'muted', inactive: 'warn' } as const;

const discountText = (promotion: Promotion) => (promotion.discountType === 'PERCENTAGE' ? `${Number(promotion.value)}% de descuento` : `${formatMoney(promotion.value)} menos por unidad`);

function scopeText(promotion: Promotion): string {
  if (promotion.scope === 'CATEGORY') return `Categoría ${promotion.category?.name ?? ''}`;
  if (promotion.scope === 'PRODUCTS') return `${promotion.products.length} ${promotion.products.length === 1 ? 'producto' : 'productos'}`;
  return 'Todo el catálogo';
}

export function PromotionsManager() {
  const { data: profile } = useSession();
  const [status, setStatus] = useState<PromotionState | 'all'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const promotions = usePromotions(status, page);

  // Las promociones de "todas las sucursales" solo las toca el superadmin; el gerente las ve pero no las edita.
  const canEdit = (promotion: Promotion) => profile?.role === 'SUPERADMIN' || promotion.branch?.id === profile?.branchId;

  function open(promotion: Promotion | null) {
    setEditing(promotion);
    setDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Promociones"
        description="Descuentos por evento: vuelta a clases, Black Friday, liquidaciones. Elegí a quién, qué productos y cuándo."
        actions={
          <Button size="lg" onClick={() => open(null)}>
            <PlusIcon /> Nueva promoción
          </Button>
        }
      />

      <div role="tablist" aria-label="Estado" className="inline-flex flex-wrap rounded-lg bg-muted p-1 text-sm">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={status === filter}
            onClick={() => {
              setStatus(filter);
              setPage(1);
            }}
            className={cn('rounded-md px-3 py-1.5 font-medium', status === filter && 'bg-white shadow-sm')}
          >
            {filter === 'all' ? 'Todas' : STATE_LABEL[filter]}
          </button>
        ))}
      </div>

      {promotions.isPending ? (
        <ListSkeleton />
      ) : promotions.isError ? (
        <LoadError />
      ) : promotions.data.items.length === 0 ? (
        <EmptyState>No hay promociones en este estado.</EmptyState>
      ) : (
        <div className={cn('space-y-3', promotions.isPlaceholderData && 'opacity-60')}>
          <ul className="space-y-3" data-testid="promotions-list">
            {promotions.data.items.map((promotion) => (
              <li key={promotion.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-black/5" data-testid="promotion-item">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{promotion.name}</span>
                    <Pill tone={TONE[promotion.state]}>{STATE_LABEL[promotion.state]}</Pill>
                  </p>
                  <p className="text-sm font-medium text-brand">{discountText(promotion)}</p>
                  <p className="text-xs text-muted-foreground">
                    {scopeText(promotion)} · {AUDIENCE_LABEL[promotion.audience]} · {promotion.branch ? promotion.branch.name : 'Todas las sucursales'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Del {formatDateTime(promotion.startsAt)} al {formatDateTime(promotion.endsAt)}
                  </p>
                </div>
                {canEdit(promotion) ? (
                  <Button variant="outline" size="sm" onClick={() => open(promotion)} aria-label={`Editar ${promotion.name}`}>
                    Editar
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">La administra el superadmin</span>
                )}
              </li>
            ))}
          </ul>
          <Pager page={page} limit={promotions.data.limit} total={promotions.data.total} onPage={setPage} disabled={promotions.isPlaceholderData} />
        </div>
      )}

      <PromotionDialog promotion={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
