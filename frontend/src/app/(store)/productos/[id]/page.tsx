import { ChevronRightIcon, PackageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AddToCart } from '@/components/shop/add-to-cart';
import { BranchAvailability } from '@/components/store/branch-availability';
import { Container } from '@/components/store/container';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/money';
import { fetchProduct, fetchProductSummary, getSelectedBranchId } from '@/lib/store-api';
import { SITE } from '@/lib/site';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await fetchProductSummary((await params).id);
  // Un producto inexistente responde 404 de verdad (no un 200 con el cartel): importa para buscadores y enlaces rotos.
  if (!product) notFound();
  return {
    title: product.name,
    description: product.description ?? `${product.name} en ${SITE.name}. Retiro en sucursal con stock en tiempo real.`,
    openGraph: { title: product.name, images: product.image ? [product.image.detail] : undefined },
  };
}

export default function ProductPage({ params }: { params: Params }) {
  return (
    <Container className="py-6">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetail params={params} />
      </Suspense>
    </Container>
  );
}

async function ProductDetail({ params }: { params: Params }) {
  const [product, selectedBranchId] = await Promise.all([fetchProduct((await params).id), getSelectedBranchId()]);
  const { price } = product;

  return (
    <article className="space-y-6">
      <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-brand">
          Inicio
        </Link>
        <ChevronRightIcon className="size-3" aria-hidden />
        <Link href={`/productos?category=${product.category.slug}`} className="hover:text-brand">
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- variante WebP ya dimensionada por el backend
            <img src={product.image.detail} alt={product.name} width={1200} height={1200} fetchPriority="high" className="size-full object-cover" />
          ) : (
            <PackageIcon className="absolute inset-0 m-auto size-16 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">{product.name}</h1>
            {product.description && <p className="text-muted-foreground">{product.description}</p>}
          </div>

          <div className="space-y-1 rounded-xl bg-white p-4 ring-1 ring-black/5">
            {price.listPrice && (
              <p className="flex items-center gap-2 text-sm">
                <s className="text-muted-foreground">{formatPrice(price.listPrice)}</s>
                <span className="rounded bg-sale px-2 py-0.5 text-xs font-bold text-white">{price.discountPercent}% OFF</span>
              </p>
            )}
            <p className="text-4xl font-extrabold tracking-tight">{formatPrice(price.price)}</p>
            {price.promotion && <p className="text-sm font-medium text-brand">{price.promotion.name}</p>}
          </div>

          <AddToCart productId={product.id} availability={product.availability} />

          <BranchAvailability productId={product.id} initial={product.branches} selectedBranchId={selectedBranchId} />
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Skeleton className="aspect-square rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
