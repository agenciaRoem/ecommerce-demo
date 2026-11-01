import { PackageIcon } from 'lucide-react';
import Link from 'next/link';
import { fetchCategories } from '@/lib/store-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselItem } from './carousel';

/** Fila de categorías con una foto representativa de cada una. */
export async function CategoryStrip() {
  const categories = (await fetchCategories()).filter((c) => c.productCount > 0);
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categorías">
      <Carousel label="Categorías">
        {categories.map((category) => (
          <CarouselItem key={category.id} className="w-[30%] sm:w-[22%] md:w-[17%] lg:w-[14%]">
            <Link
              href={`/productos?category=${category.slug}`}
              className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center transition hover:bg-white focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-black/5 md:size-28">
                {category.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- variante WebP ya dimensionada por el backend
                  <img src={category.image.thumb} alt="" width={200} height={200} loading="lazy" className="size-full object-cover transition group-hover:scale-110" />
                ) : (
                  <PackageIcon className="size-8 text-muted-foreground" />
                )}
              </span>
              <span className="text-sm font-medium leading-tight">{category.name}</span>
            </Link>
          </CarouselItem>
        ))}
      </Carousel>
    </nav>
  );
}

export function CategoryStripSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex w-[30%] shrink-0 flex-col items-center gap-2 sm:w-[22%] md:w-[17%] lg:w-[14%]">
          <Skeleton className="size-24 rounded-full md:size-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
