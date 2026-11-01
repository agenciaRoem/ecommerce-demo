'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PriceRow, usePriceHistory, useUpdatePrice } from '@/lib/backoffice/prices';
import { marginOf, parseAmount } from '@/lib/backoffice/numbers';
import { formatMoney } from '@/lib/money';
import { Field, errorMessage, formatDateTime } from '../common';

/** Reglas que el servidor también aplica; se repiten acá para avisar antes de enviar. */
function validate(cost: number | null, retail: number | null, wholesale: number | null): string | null {
  if (cost === null || retail === null || wholesale === null) return 'Completá los tres importes (hasta 2 decimales).';
  if (retail < cost || wholesale < cost) return 'Un precio de venta no puede quedar por debajo del costo.';
  if (wholesale > retail) return 'El precio mayorista no puede superar al minorista.';
  return null;
}

function History({ productId }: { productId: string }) {
  const history = usePriceHistory(productId);
  if (history.isPending) return <Skeleton className="h-16" />;
  if (!history.data?.length) return <p className="text-sm text-muted-foreground">Todavía no se cambió ningún precio.</p>;
  return (
    <ul className="divide-y text-sm" data-testid="price-history">
      {history.data.map((entry) => (
        <li key={entry.id} className="space-y-0.5 py-2">
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.at)} · {entry.by ?? 'Sistema'}
            {entry.note && ` · ${entry.note}`}
          </p>
          <p>
            {entry.cost.from !== entry.cost.to && <span className="mr-3">Costo {formatMoney(entry.cost.from)} → <b>{formatMoney(entry.cost.to)}</b></span>}
            {entry.retailPrice.from !== entry.retailPrice.to && <span className="mr-3">Minorista {formatMoney(entry.retailPrice.from)} → <b>{formatMoney(entry.retailPrice.to)}</b></span>}
            {entry.wholesalePrice.from !== entry.wholesalePrice.to && <span>Mayorista {formatMoney(entry.wholesalePrice.from)} → <b>{formatMoney(entry.wholesalePrice.to)}</b></span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function PriceDialog({ row, onClose }: { row: PriceRow | null; onClose: () => void }) {
  return (
    <ModalDialog open={row !== null} onClose={onClose} labelledBy="price-dialog-title" className="w-[min(94vw,36rem)]">
      {row && <PriceForm key={row.id} row={row} onClose={onClose} />}
    </ModalDialog>
  );
}

function PriceForm({ row, onClose }: { row: PriceRow; onClose: () => void }) {
  const update = useUpdatePrice();
  const [cost, setCost] = useState(row.cost);
  const [retail, setRetail] = useState(row.retailPrice);
  const [wholesale, setWholesale] = useState(row.wholesalePrice);
  const [note, setNote] = useState('');

  const values = { cost: parseAmount(cost), retail: parseAmount(retail), wholesale: parseAmount(wholesale) };
  const problem = validate(values.cost, values.retail, values.wholesale);
  const unchanged = values.cost === Number(row.cost) && values.retail === Number(row.retailPrice) && values.wholesale === Number(row.wholesalePrice);
  const margin = (price: number | null) => (price !== null && values.cost !== null ? marginOf(price, values.cost) : null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problem || unchanged) return;
    update.mutate(
      { id: row.id, cost: values.cost!, retailPrice: values.retail!, wholesalePrice: values.wholesale!, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Precios actualizados');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar')),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <header>
        <h2 id="price-dialog-title" className="text-lg font-extrabold">
          Precios de {row.name}
        </h2>
        <p className="font-mono text-xs text-muted-foreground">{row.sku} · {row.category.name}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Costo" htmlFor="price-cost">
          <Input id="price-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="h-11" />
        </Field>
        <Field label="Minorista" htmlFor="price-retail" hint={margin(values.retail) ? `${margin(values.retail)}% sobre el costo` : undefined}>
          <Input id="price-retail" inputMode="decimal" value={retail} onChange={(e) => setRetail(e.target.value)} className="h-11" />
        </Field>
        <Field label="Mayorista (B2B)" htmlFor="price-wholesale" hint={margin(values.wholesale) ? `${margin(values.wholesale)}% sobre el costo` : undefined}>
          <Input id="price-wholesale" inputMode="decimal" value={wholesale} onChange={(e) => setWholesale(e.target.value)} className="h-11" />
        </Field>
      </div>

      <Field label="Motivo (opcional)" htmlFor="price-note" hint="Queda en el historial. Ej.: aumento del proveedor.">
        <Input id="price-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="h-11" />
      </Field>

      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        Los precios rigen en todas las sucursales y en la tienda al instante. Los pedidos ya hechos conservan el precio con el que se compraron.
      </p>

      {problem && !unchanged && (
        <p role="alert" className="text-sm text-red-600">
          {problem}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={Boolean(problem) || unchanged || update.isPending}>
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>

      <section className="border-t pt-3">
        <h3 className="mb-1 text-sm font-bold">Historial de cambios</h3>
        <History productId={row.id} />
      </section>
    </form>
  );
}
