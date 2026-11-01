import { PackageIcon } from 'lucide-react';
import { formatPrice } from '@/lib/money';
import type { Order } from '@/lib/shop-api';

/** Productos y totales de un pedido, tal como se compraron (precios congelados). */
export function OrderSummary({ order }: { order: Pick<Order, 'items' | 'subtotal' | 'shippingCost' | 'total' | 'deliveryMethod'> }) {
  return (
    <section aria-labelledby="order-items-title" className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-black/5">
      <h2 id="order-items-title" className="font-bold">
        Productos
      </h2>
      <ul className="divide-y">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- variante WebP ya dimensionada por el backend
                <img src={item.image.thumb} alt="" width={200} height={200} className="size-full object-cover" />
              ) : (
                <PackageIcon className="m-auto mt-4 size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} × {formatPrice(Number(item.unitPrice) - Number(item.discountAmount))}
                {Number(item.discountAmount) > 0 && <s className="ml-2">{formatPrice(item.unitPrice)}</s>}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">{formatPrice(item.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{order.deliveryMethod === 'SHIPPING' ? 'Envío' : 'Retiro en sucursal'}</dt>
          <dd>{Number(order.shippingCost) > 0 ? formatPrice(order.shippingCost) : order.deliveryMethod === 'SHIPPING' ? 'A coordinar' : 'Gratis'}</dd>
        </div>
        <div className="flex justify-between pt-2 text-lg font-extrabold">
          <dt>Total</dt>
          <dd data-testid="order-total">{formatPrice(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
