'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { useAdminBranches } from '@/lib/backoffice/administration';
import { parseAmount } from '@/lib/backoffice/numbers';
import { AUDIENCE_LABEL, Audience, DiscountType, Promotion, PromotionInput, PromotionScope, useSavePromotion } from '@/lib/backoffice/promotions';
import { useCategories } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Field, errorMessage, fieldErrors } from '../common';
import { PickedProduct, ProductPicker } from './product-picker';

/** `datetime-local` trabaja con hora local sin zona; el servidor guarda instantes. */
const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const fromLocalInput = (value: string): string => new Date(value).toISOString();
const inDays = (days: number): string => toLocalInput(new Date(Date.now() + days * 86_400_000).toISOString());

const SCOPE_LABEL: Record<PromotionScope, string> = { ALL: 'Todo el catálogo', CATEGORY: 'Una categoría', PRODUCTS: 'Productos puntuales' };

export function PromotionDialog({ promotion, open, onClose }: { promotion: Promotion | null; open: boolean; onClose: () => void }) {
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="promotion-dialog-title" className="w-[min(94vw,40rem)]">
      {open && <PromotionForm key={promotion?.id ?? 'new'} promotion={promotion} onClose={onClose} />}
    </ModalDialog>
  );
}

function PromotionForm({ promotion, onClose }: { promotion: Promotion | null; onClose: () => void }) {
  const { data: profile } = useSession();
  const isSuperadmin = profile?.role === 'SUPERADMIN';
  const categories = useCategories();
  const branches = useAdminBranches(isSuperadmin);
  const save = useSavePromotion();

  const [name, setName] = useState(promotion?.name ?? '');
  const [description, setDescription] = useState(promotion?.description ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(promotion?.discountType ?? 'PERCENTAGE');
  const [value, setValue] = useState(promotion ? String(Number(promotion.value)) : '');
  const [audience, setAudience] = useState<Audience>(promotion?.audience ?? 'ALL');
  const [scope, setScope] = useState<PromotionScope>(promotion?.scope ?? 'ALL');
  const [categoryId, setCategoryId] = useState(promotion?.category?.id ?? '');
  const [products, setProducts] = useState<PickedProduct[]>(promotion?.products ?? []);
  const [branchId, setBranchId] = useState(promotion ? (promotion.branch?.id ?? '') : '');
  const [startsAt, setStartsAt] = useState(promotion ? toLocalInput(promotion.startsAt) : inDays(0));
  const [endsAt, setEndsAt] = useState(promotion ? toLocalInput(promotion.endsAt) : inDays(7));
  const [isActive, setIsActive] = useState(promotion?.isActive ?? true);

  const amount = parseAmount(value);
  const problem =
    name.trim().length < 2
      ? 'Poné un nombre para identificar la promoción.'
      : amount === null || amount <= 0
        ? 'Indicá cuánto descuenta (hasta 2 decimales).'
        : discountType === 'PERCENTAGE' && amount > 100
          ? 'El porcentaje no puede pasar de 100.'
          : !startsAt || !endsAt || fromLocalInput(endsAt) <= fromLocalInput(startsAt)
            ? 'Tiene que terminar después de empezar.'
            : scope === 'CATEGORY' && !categoryId
              ? 'Elegí la categoría.'
              : scope === 'PRODUCTS' && products.length === 0
                ? 'Sumá al menos un producto.'
                : null;
  const serverErrors = fieldErrors(save.error);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (problem || amount === null) return;
    const input: PromotionInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      discountType,
      value: amount,
      audience,
      scope,
      categoryId: scope === 'CATEGORY' ? categoryId : undefined,
      productIds: scope === 'PRODUCTS' ? products.map((product) => product.id) : undefined,
      // El gerente no manda sucursal: el servidor lo deja en la suya.
      ...(isSuperadmin && { branchId: branchId || null }),
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      isActive,
    };
    save.mutate(
      { id: promotion?.id, ...input },
      {
        onSuccess: () => {
          toast.success(promotion ? 'Promoción actualizada' : 'Promoción creada');
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error, 'No se pudo guardar')),
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <header>
        <h2 id="promotion-dialog-title" className="text-lg font-extrabold">
          {promotion ? 'Editar promoción' : 'Nueva promoción'}
        </h2>
        <p className="text-sm text-muted-foreground">El descuento se ve en la tienda mientras esté vigente. Los pedidos ya hechos no cambian.</p>
      </header>

      <Field label="Nombre del evento" htmlFor="promo-name" error={serverErrors.name}>
        <Input id="promo-name" className="h-11" maxLength={120} placeholder="Vuelta a clases, Black Friday…" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Descripción (opcional)" htmlFor="promo-description" error={serverErrors.description}>
        <Input id="promo-description" className="h-11" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de descuento" htmlFor="promo-type">
          <NativeSelect id="promo-type" className="h-11" value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
            <option value="PERCENTAGE">Porcentaje (%)</option>
            <option value="FIXED_AMOUNT">Monto fijo por unidad ($)</option>
          </NativeSelect>
        </Field>
        <Field label={discountType === 'PERCENTAGE' ? 'Porcentaje' : 'Monto por unidad'} htmlFor="promo-value" error={serverErrors.value}>
          <Input id="promo-value" inputMode="decimal" className="h-11" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empieza" htmlFor="promo-start" error={serverErrors.startsAt}>
          <Input id="promo-start" type="datetime-local" className="h-11" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label="Termina" htmlFor="promo-end" error={serverErrors.endsAt}>
          <Input id="promo-end" type="datetime-local" className="h-11" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="¿Para quién?" htmlFor="promo-audience">
          <NativeSelect id="promo-audience" className="h-11" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABEL[key]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="¿Dónde rige?" htmlFor="promo-branch" hint={isSuperadmin ? undefined : 'Como gerente, rige en tu sucursal.'}>
          {isSuperadmin ? (
            <NativeSelect id="promo-branch" className="h-11" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.data?.filter((branch) => branch.isActive).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  Solo {branch.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input id="promo-branch" className="h-11" value={profile?.branchName ?? ''} readOnly />
          )}
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">¿Qué productos?</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(SCOPE_LABEL) as PromotionScope[]).map((key) => (
            <label key={key} className={cn('cursor-pointer rounded-xl border p-3 text-center text-sm font-medium', scope === key && 'border-brand bg-brand-soft ring-1 ring-brand')}>
              <input type="radio" name="promo-scope" className="sr-only" checked={scope === key} onChange={() => setScope(key)} />
              {SCOPE_LABEL[key]}
            </label>
          ))}
        </div>
        {scope === 'CATEGORY' && (
          <NativeSelect aria-label="Categoría" className="h-11" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Elegí una categoría…</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {scope === 'PRODUCTS' && <ProductPicker value={products} onChange={setProducts} />}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Activa (si la pausás, deja de aplicarse aunque esté en fecha)
      </label>

      {problem && (
        <p role="alert" className="text-sm text-muted-foreground">
          {problem}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={Boolean(problem) || save.isPending}>
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
