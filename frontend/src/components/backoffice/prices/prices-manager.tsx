'use client';

import { LayersIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useDebouncedValue } from '@/lib/hooks';
import { PriceRow, usePrices } from '@/lib/backoffice/prices';
import { formatMoney } from '@/lib/money';
import { useCategories } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { EmptyState, ListSkeleton, LoadError, PageHeader, Pager, Pill } from '../common';
import { BulkDialog } from './bulk-dialog';
import { PriceDialog } from './price-dialog';

const margin = (value: string | null) => (value === null ? '—' : `${value}%`);

export function PricesManager() {
  const categories = useCategories();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const prices = usePrices({ search, categoryId, includeInactive, page });

  return (
    <>
      <PageHeader
        title="Precios y costos"
        description="Ajustá un producto o actualizá muchos de una vez cuando el proveedor aumenta. Cada cambio queda en el historial."
        actions={
          <Button size="lg" onClick={() => setBulkOpen(true)}>
            <LayersIcon /> Cambio masivo
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar producto"
            placeholder="Nombre, SKU o código de barras"
            className="h-10 pl-9"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <NativeSelect
          aria-label="Categoría"
          className="h-10 w-52 text-sm"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las categorías</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => {
              setIncludeInactive(e.target.checked);
              setPage(1);
            }}
          />
          Incluir productos dados de baja
        </label>
      </div>

      {prices.isPending ? (
        <ListSkeleton />
      ) : prices.isError ? (
        <LoadError />
      ) : prices.data.items.length === 0 ? (
        <EmptyState>No hay productos con esos filtros.</EmptyState>
      ) : (
        <div className={cn('space-y-2', prices.isPlaceholderData && 'opacity-60')}>
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-black/5">
            <table className="w-full min-w-[44rem] text-left text-sm" data-testid="prices-table">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Producto</th>
                  <th className="p-3 text-right font-medium">Costo</th>
                  <th className="p-3 text-right font-medium">Minorista</th>
                  <th className="p-3 text-right font-medium">Mayorista</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {prices.data.items.map((row) => (
                  <tr key={row.id} data-testid="price-row">
                    <td className="max-w-72 p-3">
                      <span className="block truncate font-medium">{row.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.sku} · {row.category.name} {!row.isActive && <Pill tone="muted">De baja</Pill>}
                      </span>
                    </td>
                    <td className="p-3 text-right">{formatMoney(row.cost)}</td>
                    <td className="p-3 text-right">
                      <span className="block font-semibold">{formatMoney(row.retailPrice)}</span>
                      <span className="text-xs text-muted-foreground">{margin(row.retailMarginPercent)}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="block font-semibold">{formatMoney(row.wholesalePrice)}</span>
                      <span className="text-xs text-muted-foreground">{margin(row.wholesaleMarginPercent)}</span>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(row)} aria-label={`Editar precios de ${row.name}`}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} limit={prices.data.limit} total={prices.data.total} onPage={setPage} disabled={prices.isPlaceholderData} />
        </div>
      )}

      <PriceDialog row={editing} onClose={() => setEditing(null)} />
      <BulkDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </>
  );
}
