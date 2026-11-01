'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { parsePercent } from '@/lib/backoffice/numbers';
import { BulkChange, BulkPreview, BulkRequest, BulkTarget, PROBLEM_LABEL, PriceProblem, Rounding, useBulkApply, useBulkPreview } from '@/lib/backoffice/prices';
import { useCategories } from '@/lib/queries';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Field, errorMessage } from '../common';

type Mode = BulkChange['mode'];

const MODES: { value: Mode; label: string; help: string }[] = [
  { value: 'ADJUST_COST', label: 'Aumento del proveedor', help: 'Sube (o baja) el costo y los dos precios el mismo porcentaje: los márgenes se conservan.' },
  { value: 'ADJUST_PRICES', label: 'Ajustar precios de venta', help: 'Sube (o baja) solo los precios de venta. El costo no cambia.' },
  { value: 'MARGIN', label: 'Fijar margen sobre el costo', help: 'Recalcula los precios como costo + margen.' },
];

const ROUNDING_LABEL: Record<Rounding, string> = {
  NONE: 'Sin redondear',
  UNIT: 'Al peso, hacia arriba',
  TEN: 'A la decena, hacia arriba',
  HUNDRED: 'A la centena, hacia arriba',
};

const ALL_PRODUCTS = 'ALL';

export function BulkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="bulk-dialog-title" className="w-[min(94vw,44rem)]">
      {open && <BulkForm onClose={onClose} />}
    </ModalDialog>
  );
}

function PreviewResult({ preview }: { preview: BulkPreview }) {
  const problems = Object.entries(preview.problems) as [PriceProblem, number][];
  return (
    <section aria-label="Vista previa" className="space-y-3 rounded-xl bg-muted/50 p-3" data-testid="bulk-preview">
      <p className="text-sm">
        Alcanza <b>{preview.matched}</b> {preview.matched === 1 ? 'producto' : 'productos'}: <b>{preview.changed}</b> cambiarían y {preview.unchanged} quedarían igual.
      </p>
      {problems.length > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
          No se puede aplicar: {problems.map(([problem, count]) => `${count} ${PROBLEM_LABEL[problem]}`).join(' y ')}. Probá con otro valor.
        </p>
      )}
      {preview.sample.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-medium">Producto</th>
                <th className="py-1 pr-2 font-medium">Costo</th>
                <th className="py-1 pr-2 font-medium">Minorista</th>
                <th className="py-1 font-medium">Mayorista</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.sample.map((row) => (
                <tr key={row.id} className={cn(row.problem && 'bg-red-50')}>
                  <td className="max-w-48 truncate py-1.5 pr-2 font-medium" title={row.problem ?? row.name}>
                    {row.name}
                  </td>
                  {(['cost', 'retailPrice', 'wholesalePrice'] as const).map((field) => (
                    <td key={field} className="py-1.5 pr-2">
                      {row.before[field] === row.after[field] ? (
                        formatMoney(row.after[field])
                      ) : (
                        <>
                          <span className="text-muted-foreground line-through">{formatMoney(row.before[field])}</span> <b>{formatMoney(row.after[field])}</b>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.matched > preview.sample.length && <p className="pt-1 text-xs text-muted-foreground">Se muestran los primeros {preview.sample.length}; los que tienen problemas van primero.</p>}
        </div>
      )}
    </section>
  );
}

function BulkForm({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const previewMutation = useBulkPreview();
  const applyMutation = useBulkApply();

  const [target, setTarget] = useState(ALL_PRODUCTS);
  const [mode, setMode] = useState<Mode>('ADJUST_COST');
  const [percent, setPercent] = useState('');
  const [applyTo, setApplyTo] = useState<'RETAIL' | 'WHOLESALE' | 'BOTH'>('BOTH');
  const [retailMargin, setRetailMargin] = useState('');
  const [wholesaleMargin, setWholesaleMargin] = useState('');
  const [rounding, setRounding] = useState<Rounding>('NONE');
  const [note, setNote] = useState('');

  function buildRequest(): BulkRequest | string {
    const bulkTarget: BulkTarget = target === ALL_PRODUCTS ? { scope: 'ALL' } : { scope: 'CATEGORY', categoryId: target };
    let change: BulkChange;
    if (mode === 'MARGIN') {
      const retail = retailMargin.trim() ? parsePercent(retailMargin) : undefined;
      const wholesale = wholesaleMargin.trim() ? parsePercent(wholesaleMargin) : undefined;
      if (retail === null || wholesale === null || (retail !== undefined && retail < 0) || (wholesale !== undefined && wholesale < 0)) return 'Los márgenes tienen que ser porcentajes de 0 en adelante.';
      if (retail === undefined && wholesale === undefined) return 'Indicá al menos un margen.';
      change = { mode: 'MARGIN', retailMarginPercent: retail, wholesaleMarginPercent: wholesale };
    } else {
      const value = parsePercent(percent);
      if (value === null || value === 0 || value < -90) return 'Indicá un porcentaje distinto de 0 (no menor a -90).';
      change = mode === 'ADJUST_COST' ? { mode, percent: value } : { mode, percent: value, applyTo };
    }
    return { target: bulkTarget, change, rounding, note: note.trim() || undefined };
  }

  const request = buildRequest();
  const formError = typeof request === 'string' ? request : null;
  const preview = previewMutation.data;
  // Cualquier cambio en el formulario deja vieja la vista previa: hay que volver a calcularla.
  const stale = previewMutation.isSuccess && JSON.stringify(previewMutation.variables) !== JSON.stringify(request);

  function runPreview() {
    if (typeof request === 'string') return;
    previewMutation.mutate(request, { onError: (error) => toast.error(errorMessage(error, 'No se pudo calcular')) });
  }

  function apply() {
    if (typeof request === 'string') return;
    applyMutation.mutate(request, {
      onSuccess: ({ changed }) => {
        toast.success(`Se actualizaron ${changed} ${changed === 1 ? 'producto' : 'productos'}`);
        onClose();
      },
      onError: (error) => toast.error(errorMessage(error, 'No se pudo aplicar')),
    });
  }

  return (
    <div className="space-y-4 p-5">
      <header>
        <h2 id="bulk-dialog-title" className="text-lg font-extrabold">
          Cambio masivo de precios
        </h2>
        <p className="text-sm text-muted-foreground">Primero se muestra qué pasaría; no se guarda nada hasta que lo confirmes.</p>
      </header>

      <Field label="¿A qué productos?" htmlFor="bulk-target">
        <NativeSelect id="bulk-target" className="h-11" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value={ALL_PRODUCTS}>Todo el catálogo activo</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              Solo la categoría {category.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">¿Qué querés hacer?</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <label key={option.value} className={cn('cursor-pointer rounded-xl border p-3 text-sm', mode === option.value && 'border-brand bg-brand-soft ring-1 ring-brand')}>
              <input type="radio" name="bulk-mode" className="sr-only" checked={mode === option.value} onChange={() => setMode(option.value)} />
              <span className="block font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'MARGIN' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Margen minorista (%)" htmlFor="bulk-retail-margin" hint="Ej.: 80 → costo + 80%. Vacío = no cambiar.">
            <Input id="bulk-retail-margin" inputMode="decimal" className="h-11" value={retailMargin} onChange={(e) => setRetailMargin(e.target.value)} />
          </Field>
          <Field label="Margen mayorista (%)" htmlFor="bulk-wholesale-margin" hint="Vacío = no cambiar.">
            <Input id="bulk-wholesale-margin" inputMode="decimal" className="h-11" value={wholesaleMargin} onChange={(e) => setWholesaleMargin(e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Porcentaje (%)" htmlFor="bulk-percent" hint="Positivo sube, negativo baja. Ej.: 10 o -5.">
            <Input id="bulk-percent" inputMode="decimal" className="h-11" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </Field>
          {mode === 'ADJUST_PRICES' && (
            <Field label="¿Qué lista?" htmlFor="bulk-apply-to">
              <NativeSelect id="bulk-apply-to" className="h-11" value={applyTo} onChange={(e) => setApplyTo(e.target.value as typeof applyTo)}>
                <option value="BOTH">Minorista y mayorista</option>
                <option value="RETAIL">Solo minorista</option>
                <option value="WHOLESALE">Solo mayorista</option>
              </NativeSelect>
            </Field>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Redondeo de precios" htmlFor="bulk-rounding">
          <NativeSelect id="bulk-rounding" className="h-11" value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)}>
            {(Object.keys(ROUNDING_LABEL) as Rounding[]).map((value) => (
              <option key={value} value={value}>
                {ROUNDING_LABEL[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Motivo (opcional)" htmlFor="bulk-note" hint="Queda en el historial y la auditoría.">
          <Input id="bulk-note" className="h-11" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      {preview && !stale && <PreviewResult preview={preview} />}
      {formError && <p className="text-sm text-muted-foreground">{formError}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="secondary" size="lg" disabled={Boolean(formError) || previewMutation.isPending} onClick={runPreview}>
          {previewMutation.isPending ? 'Calculando…' : 'Ver vista previa'}
        </Button>
        <ConfirmButton
          size="lg"
          confirmLabel="Confirmar: aplicar ahora"
          disabled={!preview || stale || !preview.canApply || applyMutation.isPending}
          onConfirm={apply}
        >
          {applyMutation.isPending ? 'Aplicando…' : preview && !stale ? `Aplicar a ${preview.changed} productos` : 'Aplicar'}
        </ConfirmButton>
      </div>
    </div>
  );
}
