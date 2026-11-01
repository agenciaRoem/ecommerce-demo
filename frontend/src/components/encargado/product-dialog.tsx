'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, errorMessage, fieldErrors } from '@/components/backoffice/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Product, UploadedImage } from '@/lib/api-types';
import { parseMoney } from '@/lib/money';
import { useUpdateProduct } from '@/lib/products-admin';
import { useCategories, useCreateProduct } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { PhotoCapture } from '../stockeo/photo-capture';
import { ProductThumb } from '../stockeo/product-thumb';

export function ProductDialog({ product, open, onClose }: { product: Product | null; open: boolean; onClose: () => void }) {
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="product-dialog-title" className="w-[min(94vw,34rem)]">
      {open && <ProductForm key={product?.id ?? 'new'} product={product} onClose={onClose} />}
    </ModalDialog>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data: profile } = useSession();
  const categories = useCategories();
  const queryClient = useQueryClient();
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const [name, setName] = useState(product?.name ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [categoryId, setCategoryId] = useState(product?.category.id ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [cost, setCost] = useState('');
  const [image, setImage] = useState<UploadedImage | null>(null);

  // El encargado no maneja precios ni stock: al crear carga el costo (de ahí sale el precio inicial) y nada más.
  const editing = product !== null;
  const canSetCost = !editing;
  const pending = create.isPending || update.isPending;
  const errors = fieldErrors(create.error ?? update.error);
  const costValue = parseMoney(cost);
  const barcodeOk = barcode.trim() === '' || /^[0-9A-Za-z-]{6,32}$/.test(barcode.trim());
  const valid = name.trim().length >= 2 && categoryId !== '' && barcodeOk && (editing || costValue !== null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const done = {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['products'] });
        toast.success(editing ? 'Producto actualizado' : 'Producto creado');
        onClose();
      },
      onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo guardar')),
    };
    if (product) {
      update.mutate(
        {
          id: product.id,
          name: name.trim(),
          barcode: barcode.trim() || null,
          categoryId,
          description: description.trim() || null,
          ...(image && { imageKey: image.imageKey }),
        },
        done,
      );
    } else {
      create.mutate(
        {
          name: name.trim(),
          categoryId,
          cost: costValue!,
          quantity: 0,
          ...(barcode.trim() && { barcode: barcode.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(image && { imageKey: image.imageKey }),
        },
        done,
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <header className="flex items-center gap-3">
        {product && <ProductThumb image={product.image} className="size-16" />}
        <div className="min-w-0">
          <h2 id="product-dialog-title" className="text-lg font-extrabold">
            {product ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          {product && <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>}
        </div>
      </header>

      <PhotoCapture value={image} onChange={setImage} />

      <Field label="Nombre" htmlFor="product-name" error={errors.name}>
        <Input id="product-name" className="h-11" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Código de barras (opcional)" htmlFor="product-barcode" error={errors.barcode ?? (barcodeOk ? undefined : 'Entre 6 y 32 caracteres: letras, números o guiones')}>
        <Input id="product-barcode" className="h-11 font-mono" autoComplete="off" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      </Field>
      <Field label="Categoría" htmlFor="product-category" error={errors.categoryId}>
        <NativeSelect id="product-category" className="h-11" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Elegir categoría…</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Descripción (opcional)" htmlFor="product-description" error={errors.description}>
        <Textarea id="product-description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {canSetCost && (
        <Field label="Costo por unidad" htmlFor="product-cost" hint="De acá sale el precio de venta inicial; gerencia lo ajusta después." error={errors.cost}>
          <Input id="product-cost" inputMode="decimal" placeholder="0,00" className="h-11" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
      )}
      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        {profile?.role === 'ENCARGADO_STOCK'
          ? 'Acá se da de alta y se corrige el producto. Los precios los maneja gerencia y las unidades las carga el personal de depósito.'
          : 'Los precios se editan en Precios y costos; las unidades se cargan desde Carga de stock.'}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={!valid || pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
