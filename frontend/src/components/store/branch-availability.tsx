'use client';

import { useQuery } from '@tanstack/react-query';
import { StoreIcon } from 'lucide-react';
import { api } from '@/lib/api';
import type { BranchAvailability as Branch } from '@/lib/catalog-types';
import { cn } from '@/lib/utils';
import { AvailabilityBadge } from './availability-badge';

const REFRESH_MS = 20_000;

/** Stock por sucursal. Parte de lo que renderizó el servidor y se actualiza solo mientras la ficha está abierta. */
export function BranchAvailability({
  productId,
  initial,
  selectedBranchId,
}: {
  productId: string;
  initial: Branch[];
  selectedBranchId?: string;
}) {
  const { data: branches } = useQuery({
    queryKey: ['availability', productId],
    queryFn: () => api<Branch[]>(`/catalog/products/${productId}/availability`, { audience: 'customer' }),
    initialData: initial,
    staleTime: 0,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <section aria-labelledby="availability-title" className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-black/5">
      <div>
        <h2 id="availability-title" className="font-bold">
          Retirá en sucursal
        </h2>
        <p className="text-xs text-muted-foreground">Stock en tiempo real. Sin costo de retiro.</p>
      </div>
      <ul className="divide-y" aria-live="polite">
        {branches.map((branch) => (
          <li
            key={branch.id}
            className={cn('flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0', branch.id === selectedBranchId && 'font-semibold')}
          >
            <div className="flex min-w-0 items-start gap-2">
              <StoreIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {branch.name}
                  {branch.id === selectedBranchId && <span className="ml-2 text-xs font-medium text-brand">Tu sucursal</span>}
                </p>
                <p className="truncate text-xs font-normal text-muted-foreground">{branch.address}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <AvailabilityBadge level={branch.level} />
              {branch.level !== 'out' && (
                <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                  {branch.available} {branch.available === 1 ? 'unidad' : 'unidades'}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
