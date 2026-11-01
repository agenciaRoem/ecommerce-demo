'use client';

import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ApiError } from '@/lib/api';
import type { UploadedImage } from '@/lib/api-types';
import { parseMoney } from '@/lib/money';
import { useCategories, useCreateProduct } from '@/lib/queries';
import { PhotoCapture } from './photo-capture';

const formSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa el nombre del producto').max(120, 'Máximo 120 caracteres'),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{6,32}$/, 'Entre 6 y 32 caracteres: letras, números o guiones')
    .or(z.literal('')),
  categoryId: z.string().min(1, 'Elige una categoría'),
  cost: z.string().refine((value) => parseMoney(value) !== null, 'Ingresa un importe válido, ej. 1500,50'),
  quantity: z
    .string()
    .regex(/^\d+$/, 'Ingresa un número entero')
    .refine((value) => Number(value) <= 100_000, 'Máximo 100.000 unidades'),
});

type FieldName = keyof z.infer<typeof formSchema>;
type FieldErrors = Partial<Record<FieldName, string>>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function NewProductForm({ initialBarcode }: { initialBarcode: string }) {
  const router = useRouter();
  const categories = useCategories();
  const createProduct = useCreateProduct();

  const [image, setImage] = useState<UploadedImage | null>(null);
  const [values, setValues] = useState({ name: '', barcode: initialBarcode, categoryId: '', cost: '', quantity: '1' });
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // El error de un campo deja de mostrarse en cuanto el usuario lo edita.
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as FieldName] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});

    const { name, barcode, categoryId, cost, quantity } = parsed.data;
    createProduct.mutate(
      {
        name,
        categoryId,
        cost: parseMoney(cost)!,
        quantity: Number(quantity),
        ...(barcode && { barcode }),
        ...(image && { imageKey: image.imageKey }),
      },
      {
        onSuccess: (product) => {
          toast.success(`"${product.name}" cargado con ${product.stock.available} unidades`);
          router.push('/stockeo');
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.message : 'No se pudo guardar el producto';
          if (error instanceof ApiError && error.status === 409) setErrors({ barcode: message });
          else toast.error(message);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <PhotoCapture value={image} onChange={setImage} />

      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" className="h-12 text-base" value={values.name} onChange={(e) => set('name')(e.target.value)} aria-invalid={!!errors.name} />
        <FieldError message={errors.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="barcode">Código de barras (opcional)</Label>
        <Input
          id="barcode"
          inputMode="text"
          autoComplete="off"
          className="h-12 font-mono text-base"
          value={values.barcode}
          onChange={(e) => set('barcode')(e.target.value)}
          aria-invalid={!!errors.barcode}
        />
        <FieldError message={errors.barcode} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <NativeSelect
          id="category"
          value={values.categoryId}
          onChange={(e) => set('categoryId')(e.target.value)}
          disabled={categories.isPending}
          aria-invalid={!!errors.categoryId}
        >
          <option value="">{categories.isPending ? 'Cargando…' : 'Elegir categoría'}</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError message={errors.categoryId} />
        {categories.isError && <FieldError message="No se pudieron cargar las categorías." />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cost">Costo por unidad</Label>
          <Input
            id="cost"
            inputMode="decimal"
            placeholder="0,00"
            className="h-12 text-base"
            value={values.cost}
            onChange={(e) => set('cost')(e.target.value)}
            aria-invalid={!!errors.cost}
          />
          <FieldError message={errors.cost} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Unidades</Label>
          <Input
            id="quantity"
            inputMode="numeric"
            pattern="[0-9]*"
            className="h-12 text-base"
            value={values.quantity}
            onChange={(e) => set('quantity')(e.target.value.replace(/\D/g, ''))}
            aria-invalid={!!errors.quantity}
          />
          <FieldError message={errors.quantity} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El precio de venta se calcula automáticamente a partir del costo; un gerente puede ajustarlo después.
      </p>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={createProduct.isPending}>
        {createProduct.isPending && <Loader2Icon className="animate-spin" />}
        Guardar producto
      </Button>
    </form>
  );
}
