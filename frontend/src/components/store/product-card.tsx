import { PackageIcon } from 'lucide-react';
import Link from 'next/link';
import type { CatalogProduct } from '@/lib/catalog-types';
import { formatPrice } from '@/lib/money';
import { AvailabilityBadge } from './availability-badge';

export function ProductCard({ product, branchName }: { product: CatalogProduct; branchName?: string }) {
  const { price } = product;

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group flex h-full flex-col rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- el backend ya entrega variantes WebP dimensionadas
          <img
            src={product.image.card}
            alt=""
            width={600}
            height={600}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <PackageIcon className="absolute inset-0 m-auto size-10 text-muted-foreground" />
        )}
        {price.promotion && (
          <span className="absolute left-2 top-2 max-w-[80%] truncate rounded-md bg-brand px-2 py-0.5 text-[11px] font-bold uppercase text-white">
            {price.promotion.name}
          </span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-foreground">{product.name}</h3>

      <div className="mt-2 min-h-[4.25rem]">
        {price.listPrice && (
          <p className="flex items-center gap-2 text-xs">
            <s className="text-muted-foreground">{formatPrice(price.listPrice)}</s>
            <span className="rounded bg-sale px-1.5 py-0.5 font-bold text-white">{price.discountPercent}% OFF</span>
          </p>
        )}
        <p className="text-xl font-bold tracking-tight">{formatPrice(price.price)}</p>
      </div>

      <div className="mt-auto pt-2">
        <AvailabilityBadge level={product.availability} branchName={branchName} />
      </div>
    </Link>
  );
}
