'use client';

import { Loader2Icon, MinusIcon, PlusIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import type { Product } from '@/lib/api-types';
import { useReceiveStock } from '@/lib/queries';

const MAX_QUANTITY = 100_000;

/** Ingreso de mercadería de un producto ya cargado, en la sucursal del usuario. */
export function ReceiptForm({ product }: { product: Product }) {
  const receive = useReceiveStock();
  const [quantity, setQuantity] = useState('1');

  const amount = Number(quantity);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= MAX_QUANTITY;

  const step = (delta: number) => setQuantity(String(Math.min(MAX_QUANTITY, Math.max(1, (valid ? amount : 0) + delta))));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    receive.mutate(
      { productId: product.id, quantity: amount },
      {
        onSuccess: (result) => {
          toast.success(`+${amount} ingresadas. Stock ahora: ${result.stock}`);
          setQuantity('1');
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el ingreso'),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Label htmlFor="receipt-quantity">Unidades que ingresan</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Menos" onClick={() => step(-1)}>
          <MinusIcon />
        </Button>
        <Input
          id="receipt-quantity"
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-12 text-center text-lg"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!valid}
        />
        <Button type="button" variant="outline" size="icon-lg" className="size-12" aria-label="Más" onClick={() => step(1)}>
          <PlusIcon />
        </Button>
      </div>
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!valid || receive.isPending}>
        {receive.isPending && <Loader2Icon className="animate-spin" />}
        Registrar ingreso
      </Button>
    </form>
  );
}
