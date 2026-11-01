'use client';

import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/lib/hooks';
import { usePrices } from '@/lib/backoffice/prices';

export interface PickedProduct {
  id: string;
  name: string;
  sku: string;
}

const MAX_PRODUCTS = 500;

/** Elegir productos puntuales buscándolos por nombre, SKU o código de barras. */
export function ProductPicker({ value, onChange }: { value: PickedProduct[]; onChange: (products: PickedProduct[]) => void }) {
  const [input, setInput] = useState('');
  const search = useDebouncedValue(input.trim());
  const results = usePrices({ search, categoryId: '', includeInactive: false, page: 1 });
  const picked = new Set(value.map((product) => product.id));
  const options = search.length >= 2 ? (results.data?.items ?? []).filter((row) => !picked.has(row.id)) : [];

  return (
    <div className="space-y-2">
      <Input
        type="search"
        aria-label="Buscar producto para sumar"
        placeholder="Buscá por nombre, SKU o código de barras"
        className="h-11"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {options.length > 0 && (
        <ul className="max-h-44 divide-y overflow-y-auto rounded-lg border text-sm" data-testid="picker-results">
          {options.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-brand-soft disabled:opacity-50"
                disabled={value.length >= MAX_PRODUCTS}
                onClick={() => {
                  onChange([...value, { id: row.id, name: row.name, sku: row.sku }]);
                  setInput('');
                }}
              >
                <span className="truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{row.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.length >= 2 && !results.isPending && options.length === 0 && <p className="text-xs text-muted-foreground">Sin resultados.</p>}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Productos elegidos" data-testid="picked-products">
          {value.map((product) => (
            <li key={product.id} className="flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-xs font-medium text-brand">
              {product.name}
              <button type="button" aria-label={`Quitar ${product.name}`} className="rounded-full p-1 hover:bg-white" onClick={() => onChange(value.filter((p) => p.id !== product.id))}>
                <XIcon className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
