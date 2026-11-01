import { PackageIcon } from 'lucide-react';
import type { ImageUrls } from '@/lib/api-types';
import { cn } from '@/lib/utils';

export function ProductThumb({ image, className }: { image: ImageUrls | null; className?: string }) {
  return (
    <div className={cn('flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- el backend ya entrega variantes WebP dimensionadas
        <img src={image.thumb} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <PackageIcon className="size-6 text-muted-foreground" />
      )}
    </div>
  );
}
