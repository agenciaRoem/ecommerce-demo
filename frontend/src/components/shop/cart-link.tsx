'use client';

import { ShoppingCartIcon } from 'lucide-react';
import Link from 'next/link';
import { useHydrated } from '@/lib/hooks';
import { useCartCount } from '@/lib/shop-api';

/** Ícono del carrito en la cabecera, con la cantidad de unidades. */
export function CartLink() {
  const hydrated = useHydrated();
  const { data } = useCartCount();
  // Hasta hidratar se muestra lo mismo que renderizó el servidor (sin contador).
  const count = hydrated ? (data?.count ?? 0) : 0;

  return (
    <Link href="/carrito" className="relative rounded-lg p-2 hover:bg-brand-soft" aria-label={count > 0 ? `Carrito, ${count} unidades` : 'Carrito'}>
      <ShoppingCartIcon className="size-6" aria-hidden />
      {count > 0 && (
        <span
          data-testid="cart-count"
          className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-sale px-1 text-[11px] font-bold leading-5 text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
