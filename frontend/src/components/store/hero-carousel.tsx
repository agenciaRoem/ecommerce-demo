'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HERO_SLIDES } from '@/lib/site';
import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 7000;

/** Banner principal. Avanza solo, se detiene al pasar el mouse o enfocar, y no se mueve si el usuario pidió menos animación. */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = HERO_SLIDES.length;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduce) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  const go = (next: number) => setIndex((next + count) % count);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Promociones destacadas"
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {HERO_SLIDES.map((slide, i) => (
          <article
            key={slide.id}
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${count}`}
            aria-hidden={i !== index}
            className={cn('relative flex min-h-60 w-full shrink-0 items-center bg-gradient-to-br p-6 text-white md:min-h-80 md:px-16', slide.background)}
          >
            <div aria-hidden className="absolute -right-16 -top-16 size-72 rounded-full bg-white/10 md:size-96" />
            <div aria-hidden className="absolute -bottom-24 right-24 size-56 rounded-full bg-white/10" />
            <div className="relative max-w-xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white/80">{slide.eyebrow}</p>
              <h2 className="text-2xl font-extrabold leading-tight md:text-4xl">{slide.title}</h2>
              <p className="text-sm text-white/90 md:text-base">{slide.text}</p>
              <Link
                href={slide.cta.href}
                tabIndex={i === index ? 0 : -1}
                className="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-bold text-brand-dark transition hover:bg-brand-soft"
              >
                {slide.cta.label}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        aria-label="Diapositiva anterior"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow transition hover:bg-white md:flex"
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        aria-label="Diapositiva siguiente"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow transition hover:bg-white md:flex"
      >
        <ChevronRightIcon />
      </button>

      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Ir a la diapositiva ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={cn('h-2 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-2 bg-white/50')}
          />
        ))}
      </div>
    </section>
  );
}
