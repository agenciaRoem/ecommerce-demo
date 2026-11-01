'use client';

import { CheckCircle2Icon, MinusIcon, PackageIcon, PlusIcon, Trash2Icon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/money';
import { Cart, CartLine, useCart, useRemoveFromCart, useSetCartQuantity } from '@/lib/shop-api';
import { SignedOutNotice } from './signed-out-notice';
import { useCustomerGate } from './use-customer-gate';

const MAX_QUANTITY = 999;
const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el carrito');

function Line({ line }: { line: CartLine }) {
  const setQuantity = useSetCartQuantity();
  const remove = useRemoveFromCart();
  const busy = setQuantity.isPending || remove.isPending;
  const change = (quantity: number) => setQuantity.mutate({ productId: line.productId, quantity }, { onError });

  return (
    <li className="flex gap-3 py-4" data-testid="cart-line">
      <Link href={`/productos/${line.productId}`} className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {line.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- variante WebP ya dimensionada por el backend
          <img src={line.image.thumb} alt="" width={200} height={200} className="size-full object-cover" />
        ) : (
          <PackageIcon className="m-auto mt-6 size-8 text-muted-foreground" />
        )}
      </Link>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/productos/${line.productId}`} className="line-clamp-2 text-sm font-medium hover:text-brand">
            {line.name}
          </Link>
          <p className="shrink-0 font-bold">{formatPrice(line.lineTotal)}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          {line.price.listPrice && <s className="mr-2">{formatPrice(line.price.listPrice)}</s>}
          {formatPrice(line.price.price)} c/u
          {line.price.discountPercent && <span className="ml-2 rounded bg-sale px-1.5 py-0.5 font-bold text-white">{line.price.discountPercent}% OFF</span>}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-lg" className="size-9" aria-label={`Menos unidades de ${line.name}`} disabled={busy || line.quantity <= 1} onClick={() => change(line.quantity - 1)}>
              <MinusIcon />
            </Button>
            <span className="w-10 text-center text-sm font-medium" aria-live="polite" data-testid="line-quantity">
              {line.quantity}
            </span>
            <Button type="button" variant="outline" size="icon-lg" className="size-9" aria-label={`Más unidades de ${line.name}`} disabled={busy || line.quantity >= MAX_QUANTITY} onClick={() => change(line.quantity + 1)}>
              <PlusIcon />
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate(line.productId, { onError })}>
            <Trash2Icon /> Quitar
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Qué sucursales pueden entregar TODO el carrito: se resuelve acá, antes de llegar a pagar. */
function BranchStock({ cart }: { cart: Cart }) {
  if (cart.branches.length === 0) return null;
  return (
    <section aria-labelledby="stock-title" className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-black/5">
      <h2 id="stock-title" className="text-sm font-bold">
        Stock para tu pedido por sucursal
      </h2>
      <ul className="space-y-1.5 text-sm">
        {cart.branches.map((branch) => (
          <li key={branch.id} className="flex items-start gap-2">
            {branch.canFulfill ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
            <span>
              <span className="font-medium">{branch.name}</span>{' '}
              {branch.canFulfill ? (
                <span className="text-success">tiene todo</span>
              ) : (
                <span className="text-muted-foreground">
                  le falta: {branch.shortages.map((s) => `${s.name} (pedís ${s.requested}, hay ${s.available})`).join(', ')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CartPanel() {
  const gate = useCustomerGate();
  const { data: cart, isPending, isError, refetch } = useCart();

  if (gate === 'signedOut') return <SignedOutNotice returnTo="/carrito" what="tu carrito" />;
  if (gate === 'loading' || isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (isError || !cart) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-white p-6 text-center ring-1 ring-black/5">
        <p>No pudimos cargar tu carrito.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-10 text-center ring-1 ring-black/5">
        <p className="font-semibold">Tu carrito está vacío</p>
        <Link href="/productos" className="text-sm font-semibold text-brand underline underline-offset-4">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <ul className="divide-y rounded-xl bg-white px-4 ring-1 ring-black/5">
          {cart.lines.map((line) => (
            <Line key={line.productId} line={line} />
          ))}
        </ul>
        <BranchStock cart={cart} />
      </div>

      <aside aria-label="Resumen" className="h-fit space-y-4 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="font-bold">Resumen</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{cart.count} {cart.count === 1 ? 'unidad' : 'unidades'}</dt>
            <dd data-testid="cart-subtotal" className="font-medium">{formatPrice(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Retiro en sucursal</dt>
            <dd>Gratis</dd>
          </div>
        </dl>
        <p className="flex items-baseline justify-between border-t pt-3 text-lg font-extrabold">
          Total <span>{formatPrice(cart.subtotal)}</span>
        </p>
        <Button render={<Link href="/checkout" />} size="lg" className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark">
          Continuar con la compra
        </Button>
      </aside>
    </div>
  );
}
