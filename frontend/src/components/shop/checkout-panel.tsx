'use client';

import { CheckCircle2Icon, Loader2Icon, StoreIcon, TruckIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { VerifyEmailBanner } from '@/components/account/verify-email-banner';
import { ApiError } from '@/lib/api';
import { readBranchCookie } from '@/lib/branch-cookie';
import { formatPrice } from '@/lib/money';
import { Cart, CheckoutOptions, DeliveryMethod, useCart, useCheckout, useCheckoutOptions } from '@/lib/shop-api';
import { cn } from '@/lib/utils';
import { SignedOutNotice } from './signed-out-notice';
import { useCustomerGate } from './use-customer-gate';

interface Shortage {
  name: string;
  requested: number;
  available: number;
}

const shortagesIn = (error: unknown): Shortage[] =>
  error instanceof ApiError && Array.isArray((error.details as { shortages?: unknown } | null)?.shortages)
    ? ((error.details as { shortages: Shortage[] }).shortages)
    : [];

function ChoiceCard({ selected, disabled, onSelect, icon: Icon, title, hint }: { selected: boolean; disabled?: boolean; onSelect: () => void; icon: typeof StoreIcon; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border',
        selected && 'border-brand bg-brand-soft ring-1 ring-brand',
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function CheckoutForm({ cart, options }: { cart: Cart; options: CheckoutOptions }) {
  const checkout = useCheckout();
  const [delivery, setDelivery] = useState<DeliveryMethod>('PICKUP');
  const [address, setAddress] = useState(options.shippingAddress ?? '');
  const [note, setNote] = useState('');
  const [chosenBranch, setChosenBranch] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  // Por defecto, la sucursal elegida en la cabecera si puede entregar todo; si no, la primera que pueda.
  const fulfilling = cart.branches.filter((branch) => branch.canFulfill);
  const preferred = readBranchCookie();
  const defaultBranch = fulfilling.find((branch) => branch.id === preferred) ?? fulfilling[0];
  const branchId = chosenBranch ?? defaultBranch?.id ?? null;

  const canShip = options.deliveryMethods.includes('SHIPPING');
  const needsAddress = delivery === 'SHIPPING';
  const ready = Boolean(branchId) && (!needsAddress || address.trim().length >= 5) && options.paymentsEnabled && !options.emailVerificationRequired;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!branchId || !ready) return;
    checkout.mutate(
      {
        deliveryMethod: delivery,
        branchId,
        ...(needsAddress && { shippingAddress: address.trim() }),
        ...(note.trim() && { note: note.trim() }),
      },
      {
        onSuccess: ({ checkoutUrl }) => {
          setRedirecting(true);
          window.location.assign(checkoutUrl); // sale a Mercado Pago; vuelve a /pedidos/<id>
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'No pudimos iniciar el pago'),
      },
    );
  }

  const shortages = shortagesIn(checkout.error);

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
      <div className="space-y-6">
        {options.testMode && (
          <p role="status" className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
            <strong>Modo de prueba:</strong> los pagos no usan dinero real.
          </p>
        )}
        {options.emailVerificationRequired && <VerifyEmailBanner email={options.email} />}
        {!options.paymentsEnabled && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Los pagos no están disponibles por el momento. Probá de nuevo más tarde.
          </p>
        )}

        <fieldset className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-black/5">
          <legend className="sr-only">Cómo recibís tu pedido</legend>
          <h2 className="font-bold">¿Cómo lo recibís?</h2>
          <div role="radiogroup" aria-label="Forma de entrega" className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard selected={delivery === 'PICKUP'} onSelect={() => setDelivery('PICKUP')} icon={StoreIcon} title="Retiro en sucursal" hint="Sin costo. Te avisamos cuando esté listo." />
            <ChoiceCard
              selected={delivery === 'SHIPPING'}
              disabled={!canShip}
              onSelect={() => setDelivery('SHIPPING')}
              icon={TruckIcon}
              title="Envío a domicilio"
              hint={canShip ? 'Lo coordinamos con la sucursal.' : 'Disponible para cuentas de comercio.'}
            />
          </div>

          {needsAddress && (
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="address">Dirección de entrega</Label>
              <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, localidad" />
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-black/5">
          <legend className="sr-only">Sucursal</legend>
          <h2 className="font-bold">{delivery === 'PICKUP' ? '¿En qué sucursal retirás?' : '¿Desde qué sucursal se despacha?'}</h2>
          {fulfilling.length === 0 && (
            <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
              Ninguna sucursal tiene todo tu pedido. <Link href="/carrito" className="font-semibold underline">Ajustá el carrito</Link>.
            </p>
          )}
          <div role="radiogroup" aria-label="Sucursal" className="grid gap-2">
            {cart.branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                role="radio"
                aria-checked={branchId === branch.id}
                disabled={!branch.canFulfill}
                onClick={() => setChosenBranch(branch.id)}
                data-testid={`branch-${branch.name}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border',
                  branchId === branch.id && 'border-brand bg-brand-soft ring-1 ring-brand',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{branch.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{branch.address}</span>
                  {!branch.canFulfill && <span className="block text-xs text-warning">Sin stock suficiente de algunos productos</span>}
                </span>
                {branchId === branch.id && <CheckCircle2Icon className="size-5 shrink-0 text-brand" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5 rounded-xl bg-white p-5 ring-1 ring-black/5">
          <Label htmlFor="note">Aclaraciones (opcional)</Label>
          <Textarea id="note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <aside aria-label="Resumen" className="h-fit space-y-4 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <h2 className="font-bold">Tu pedido</h2>
        <ul className="space-y-1 text-sm">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {line.quantity} × {line.name}
              </span>
              <span className="shrink-0">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>{delivery === 'SHIPPING' ? 'Envío' : 'Retiro'}</dt>
            <dd>{delivery === 'SHIPPING' ? 'A coordinar' : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between pt-1 text-lg font-extrabold">
            <dt>Total</dt>
            <dd data-testid="checkout-total">{formatPrice(cart.subtotal)}</dd>
          </div>
        </dl>

        {shortages.length > 0 && (
          <div role="alert" className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Alguien se llevó stock mientras comprabas:</p>
            <ul className="list-disc pl-5">
              {shortages.map((s) => (
                <li key={s.name}>
                  {s.name}: pedís {s.requested}, quedan {s.available}
                </li>
              ))}
            </ul>
            <Link href="/carrito" className="font-semibold underline">
              Volver al carrito
            </Link>
          </div>
        )}

        <Button type="submit" size="lg" className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark" disabled={!ready || checkout.isPending || redirecting}>
          {(checkout.isPending || redirecting) && <Loader2Icon className="animate-spin" />}
          {redirecting ? 'Redirigiendo a Mercado Pago…' : 'Pagar con Mercado Pago'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Reservamos tu stock mientras pagás. Si no completás el pago a tiempo, se libera.</p>
      </aside>
    </form>
  );
}

export function CheckoutPanel() {
  const gate = useCustomerGate();
  const cart = useCart();
  const options = useCheckoutOptions();

  if (gate === 'signedOut') return <SignedOutNotice returnTo="/checkout" what="el pago" />;
  if (gate === 'loading' || cart.isPending || options.isPending) return <Skeleton className="h-96" />;

  if (cart.isError || options.isError || !cart.data || !options.data) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">
        No pudimos cargar tu pedido. Probá de nuevo en unos segundos.
      </p>
    );
  }
  if (cart.data.lines.length === 0) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-10 text-center ring-1 ring-black/5">
        <p className="font-semibold">No tenés productos en el carrito</p>
        <Link href="/productos" className="text-sm font-semibold text-brand underline underline-offset-4">
          Ver productos
        </Link>
      </div>
    );
  }
  return <CheckoutForm cart={cart.data} options={options.data} />;
}
