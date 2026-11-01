'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const arrow =
  'absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/10 transition hover:bg-brand-soft md:flex';

/** Fila horizontal con desplazamiento táctil (scroll-snap) y flechas en pantallas grandes. */
export function Carousel({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const track = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) =>
    track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <div className={cn('relative', className)}>
      <button type="button" aria-label="Anterior" className={cn(arrow, '-left-4')} onClick={() => scroll(-1)}>
        <ChevronLeftIcon className="size-5" />
      </button>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button type="button" aria-label="Siguiente" className={cn(arrow, '-right-4')} onClick={() => scroll(1)}>
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}

/** Ancho de cada ítem dentro de un `Carousel`. */
export function CarouselItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[19%]', className)}>{children}</div>
  );
}
