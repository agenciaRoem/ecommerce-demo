'use client';

import { PackageSearchIcon, PlusIcon, ScanLineIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/money';
import { useLookup } from '@/lib/queries';
import { BarcodeScanner, useBarcodeScanSupport } from './barcode-scanner';
import { ProductThumb } from './product-thumb';
import { ReceiptForm } from './receipt-form';

/** Busca un producto por código de barras o SKU (tipeado o escaneado) y permite ingresarle stock. */
export function LookupPanel() {
  const canScan = useBarcodeScanSupport();
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const lookup = useLookup(code);

  const search = useCallback((value: string) => {
    setInput(value);
    setCode(value.trim());
  }, []);

  const onDetect = useCallback(
    (detected: string) => {
      setScanning(false);
      search(detected);
    },
    [search],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    search(input);
  }

  const product = lookup.data;

  return (
    <section aria-labelledby="lookup-title" className="space-y-4">
      <h2 id="lookup-title" className="text-base font-semibold">
        Ingresar mercadería
      </h2>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          aria-label="Código de barras o SKU"
          placeholder="Código de barras o SKU"
          inputMode="text"
          autoComplete="off"
          className="h-12 text-base"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {canScan && (
          <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Escanear" onClick={() => setScanning(true)}>
            <ScanLineIcon />
          </Button>
        )}
        <Button type="submit" size="icon-lg" className="size-12" aria-label="Buscar" disabled={!input.trim()}>
          <SearchIcon />
        </Button>
      </form>

      {scanning && <BarcodeScanner onDetect={onDetect} onClose={() => setScanning(false)} />}

      {lookup.isFetching && <Skeleton className="h-48 w-full" />}

      {lookup.isError && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo buscar el producto. Revisa tu conexión.
        </p>
      )}

      {!lookup.isFetching && product === null && (
        <div className="space-y-3 rounded-xl border border-dashed p-4 text-center">
          <PackageSearchIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm">
            No hay ningún producto con el código <span className="font-mono font-medium">{code}</span>.
          </p>
          <Button render={<Link href={`/stockeo/nuevo?barcode=${encodeURIComponent(code)}`} />} className="h-11 w-full">
            <PlusIcon /> Cargarlo como producto nuevo
          </Button>
        </div>
      )}

      {!lookup.isFetching && product && (
        <article className="space-y-4 rounded-xl border p-4">
          <div className="flex gap-3">
            <ProductThumb image={product.image} className="size-20" />
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold leading-snug">{product.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {product.category.name} · {product.sku}
              </p>
              <p className="text-sm">
                En tu sucursal: <span className="font-semibold">{product.stock.available}</span> disponibles
              </p>
              {product.cost && (
                <p className="text-xs text-muted-foreground">
                  Costo {formatMoney(product.cost)} · Público {formatMoney(product.retailPrice)}
                </p>
              )}
            </div>
          </div>
          <ReceiptForm product={product} />
        </article>
      )}
    </section>
  );
}
