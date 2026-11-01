'use client';

import { Loader2Icon, MinusIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { AdjustmentReason, InventoryRow, useAdjustStock } from '@/lib/sala-api';
import { cn } from '@/lib/utils';
import { useOperatingBranch } from './branch-context';

type Direction = 'remove' | 'add';

const REASONS: Record<Direction, { value: AdjustmentReason; label: string }[]> = {
  remove: [
    { value: 'DAMAGED', label: 'Rotura o merma' },
    { value: 'LOST', label: 'Faltante (no está en el estante)' },
    { value: 'OTHER', label: 'Otro motivo' },
  ],
  add: [
    { value: 'FOUND', label: 'Sobrante encontrado' },
    { value: 'RETURN', label: 'Devolución al estante' },
    { value: 'OTHER', label: 'Otro motivo' },
  ],
};

const MAX_UNITS = 10_000;

function AdjustForm({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const adjust = useAdjustStock(useOperatingBranch());
  const [direction, setDirection] = useState<Direction>('remove');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState<AdjustmentReason>('DAMAGED');
  const [note, setNote] = useState('');

  const units = Number(quantity);
  const validUnits = Number.isInteger(units) && units >= 1 && units <= MAX_UNITS;
  // Al cambiar de sentido el motivo elegido puede dejar de aplicar: se usa el primero que corresponda.
  const options = REASONS[direction];
  const activeReason = options.some((option) => option.value === reason) ? reason : options[0].value;
  const needsNote = activeReason === 'OTHER';
  const delta = direction === 'add' ? units : -units;
  const resulting = row.stock + (validUnits ? delta : 0);
  const exceeds = direction === 'remove' && validUnits && units > row.available;
  const ready = validUnits && (!needsNote || note.trim().length > 0) && resulting >= 0;

  const step = (by: number) => setQuantity(String(Math.min(MAX_UNITS, Math.max(1, (validUnits ? units : 0) + by))));

  function submit() {
    adjust.mutate(
      { productId: row.product.id, delta, reason: activeReason, ...(note.trim() && { note: note.trim() }) },
      {
        onSuccess: (level) => {
          toast.success(`Stock de «${row.product.name}»: ahora ${level.stock} (${level.available} disponibles)`);
          onClose();
        },
      },
    );
  }

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="adjust-dialog-title" className="text-lg font-extrabold">
            Ajustar stock
          </h2>
          <p className="truncate text-sm font-medium">{row.product.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.product.barcode ?? row.product.sku}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-lg" aria-label="Cerrar" onClick={onClose}>
          <XIcon />
        </Button>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center text-sm">
        {[['En estante', row.stock], ['Reservadas', row.reserved], ['Disponibles', row.available]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/60 p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <div role="radiogroup" aria-label="Qué querés hacer" className="grid grid-cols-2 gap-2">
        {([['remove', 'Restar unidades', MinusIcon], ['add', 'Sumar unidades', PlusIcon]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            onClick={() => setDirection(value)}
            className={cn('flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold', direction === value && 'border-brand bg-brand-soft ring-1 ring-brand')}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adjust-quantity">Cantidad</Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Menos" onClick={() => step(-1)}>
            <MinusIcon />
          </Button>
          <Input
            id="adjust-quantity"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-12 text-center text-lg"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!validUnits}
          />
          <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Más" onClick={() => step(1)}>
            <PlusIcon />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adjust-reason">Motivo</Label>
        <NativeSelect id="adjust-reason" value={activeReason} onChange={(e) => setReason(e.target.value as AdjustmentReason)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="adjust-note">{needsNote ? 'Contá qué pasó' : 'Aclaración (opcional)'}</Label>
        <Textarea id="adjust-note" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-required={needsNote} />
      </div>

      <p className="rounded-lg bg-brand-soft p-3 text-sm" aria-live="polite">
        Va a quedar en <strong data-testid="adjust-result">{resulting}</strong> unidades en el estante.
        {exceeds && (
          <span role="alert" className="mt-1 block font-medium text-warning">
            Ojo: hay {row.reserved} reservadas para pedidos en curso; solo se pueden restar {row.available}.
          </span>
        )}
      </p>

      {adjust.isError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {adjust.error instanceof ApiError ? adjust.error.message : 'No se pudo registrar el ajuste.'}
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark" disabled={!ready || adjust.isPending}>
        {adjust.isPending && <Loader2Icon className="animate-spin" />}
        Confirmar ajuste
      </Button>
    </form>
  );
}

export function AdjustDialog({ row, onClose }: { row: InventoryRow | null; onClose: () => void }) {
  return (
    <ModalDialog open={row !== null} onClose={onClose} labelledBy="adjust-dialog-title" className="w-[min(94vw,28rem)]">
      {/* La key reinicia el formulario al ajustar otro producto. */}
      {row && <AdjustForm key={row.product.id} row={row} onClose={onClose} />}
    </ModalDialog>
  );
}
