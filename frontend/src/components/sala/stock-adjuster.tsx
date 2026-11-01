'use client';

import { ScanLineIcon, SearchIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BarcodeScanner, useBarcodeScanSupport } from '@/components/stockeo/barcode-scanner';
import { ProductThumb } from '@/components/stockeo/product-thumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/lib/hooks';
import { InventoryRow, useBranchInventory } from '@/lib/sala-api';
import { AdjustDialog } from './adjust-dialog';
import { useOperatingBranch } from './branch-context';

/** Busca un producto de la sucursal (nombre, SKU o código, tipeado o escaneado) para corregir su stock. */
export function StockAdjuster() {
  const branchId = useOperatingBranch();
  const canScan = useBarcodeScanSupport();
  const [input, setInput] = useState('');
  const search = useDebouncedValue(input.trim());
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const results = useBranchInventory(branchId, search);

  const onDetect = useCallback((code: string) => {
    setScanning(false);
    setInput(code);
  }, []);

  return (
    <section aria-labelledby="adjust-title" className="space-y-4">
      <div>
        <h1 id="adjust-title" className="text-xl font-extrabold">
          Ajuste de stock
        </h1>
        <p className="text-sm text-muted-foreground">Para corregir lo que hay en el estante: roturas, faltantes o sobrantes. Cada ajuste queda registrado con tu nombre.</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar producto"
            placeholder="Nombre, SKU o código de barras"
            autoComplete="off"
            className="h-12 pl-9 text-base"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        {canScan && (
          <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Escanear" onClick={() => setScanning(true)}>
            <ScanLineIcon />
          </Button>
        )}
      </div>

      {scanning && <BarcodeScanner onDetect={onDetect} onClose={() => setScanning(false)} />}

      {search.length < 2 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Escribí al menos 2 letras para buscar.</p>
      ) : results.isPending ? (
        <Skeleton className="h-40" />
      ) : results.isError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudo buscar. Probá de nuevo.
        </p>
      ) : results.data.items.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-muted-foreground ring-1 ring-black/5">No hay productos con ese dato en esta sucursal.</p>
      ) : (
        <ul className="divide-y rounded-xl bg-white ring-1 ring-black/5" data-testid="stock-results">
          {results.data.items.map((row) => (
            <li key={row.product.id}>
              <button type="button" onClick={() => setSelected(row)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-brand-soft">
                <ProductThumb image={row.product.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.product.name}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{row.product.barcode ?? row.product.sku}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block text-lg font-extrabold text-foreground">{row.stock}</span>
                  {row.reserved > 0 ? `${row.reserved} reservadas` : 'en estante'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AdjustDialog row={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
