'use client';

import { Loader2Icon, MinusIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { AvailabilityLevel } from '@/lib/catalog-types';
import { loginHref } from '@/lib/return-path';
import { useAddToCart } from '@/lib/shop-api';
import { useCustomerGate } from './use-customer-gate';

const MAX_QUANTITY = 999;

/** Cantidad + "Agregar al carrito". Sin sesión, lleva a ingresar y vuelve a esta ficha. */
export function AddToCart({ productId, availability }: { productId: string; availability: AvailabilityLevel }) {
  const router = useRouter();
  const gate = useCustomerGate();
  const add = useAddToCart();
  const [quantity, setQuantity] = useState('1');

  const amount = Number(quantity);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= MAX_QUANTITY;
  const soldOut = availability === 'out';

  const step = (delta: number) => setQuantity(String(Math.min(MAX_QUANTITY, Math.max(1, (valid ? amount : 0) + delta))));

  function onAdd() {
    if (gate !== 'signedIn') return router.push(loginHref(`/productos/${productId}`));
    add.mutate(
      { productId, quantity: amount },
      {
        onSuccess: () =>
          toast.success(`Agregaste ${amount} ${amount === 1 ? 'unidad' : 'unidades'} al carrito`, {
            action: { label: 'Ver carrito', onClick: () => router.push('/carrito') },
          }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'No se pudo agregar al carrito'),
      },
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon-lg" className="size-11" aria-label="Menos" onClick={() => step(-1)} disabled={soldOut}>
          <MinusIcon />
        </Button>
        <Input
          aria-label="Cantidad"
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-11 w-20 text-center text-base"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!valid}
          disabled={soldOut}
        />
        <Button type="button" variant="outline" size="icon-lg" className="size-11" aria-label="Más" onClick={() => step(1)} disabled={soldOut}>
          <PlusIcon />
        </Button>
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark"
        disabled={soldOut || !valid || add.isPending}
        onClick={onAdd}
      >
        {add.isPending ? <Loader2Icon className="animate-spin" /> : <ShoppingCartIcon />}
        {soldOut ? 'Sin stock' : 'Agregar al carrito'}
      </Button>
      {gate === 'signedOut' && !soldOut && <p className="text-center text-xs text-muted-foreground">Vas a ingresar a tu cuenta para guardar el carrito.</p>}
    </div>
  );
}
