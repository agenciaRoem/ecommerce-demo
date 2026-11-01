'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/lib/hooks';
import { LOW_STOCK_THRESHOLD, useInventory } from '@/lib/queries';
import { ProductThumb } from './product-thumb';

export function InventoryList() {
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const inventory = useInventory(useDebouncedValue(search.trim()), lowStock);

  const rows = inventory.data?.pages.flatMap((page) => page.items) ?? [];
  const total = inventory.data?.pages[0]?.total ?? 0;

  return (
    <section aria-labelledby="inventory-title" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="inventory-title" className="text-base font-semibold">
          Inventario de la sucursal
        </h2>
        {inventory.data && <span className="text-xs text-muted-foreground">{total} productos</span>}
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar en el inventario"
          placeholder="Buscar por nombre, SKU o código"
          className="h-11 pl-9 text-base"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Button
        type="button"
        variant={lowStock ? 'default' : 'outline'}
        size="sm"
        aria-pressed={lowStock}
        className="h-9"
        onClick={() => setLowStock((value) => !value)}
      >
        Stock bajo (≤ {LOW_STOCK_THRESHOLD})
      </Button>

      {inventory.isPending && (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-full" />
          ))}
        </div>
      )}

      {inventory.isError && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo cargar el inventario.
        </p>
      )}

      {inventory.data && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No hay productos para mostrar.</p>
      )}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.product.id} className="flex items-center gap-3 rounded-xl border p-3">
            <ProductThumb image={row.product.image} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.product.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.product.barcode ?? row.product.sku}</p>
            </div>
            <Badge variant={row.available <= LOW_STOCK_THRESHOLD ? 'destructive' : 'secondary'} className="shrink-0 text-sm">
              {row.available}
            </Badge>
          </li>
        ))}
      </ul>

      {inventory.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={inventory.isFetchingNextPage}
          onClick={() => inventory.fetchNextPage()}
        >
          {inventory.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
        </Button>
      )}
    </section>
  );
}
