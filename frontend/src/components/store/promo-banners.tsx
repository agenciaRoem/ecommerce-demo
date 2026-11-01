import Link from 'next/link';
import { PROMO_BANNERS } from '@/lib/site';
import { cn } from '@/lib/utils';

export function PromoBanners() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PROMO_BANNERS.map((banner) => (
        <Link
          key={banner.id}
          href={banner.href}
          className={cn(
            'group relative flex min-h-32 flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-r p-6 text-white md:min-h-40 md:p-8',
            banner.background,
          )}
        >
          <div aria-hidden className="absolute -right-10 -top-10 size-44 rounded-full bg-white/15 transition group-hover:scale-110" />
          <p className="relative text-xs font-bold uppercase tracking-widest text-white/85">{banner.kicker}</p>
          <p className="relative text-2xl font-extrabold md:text-3xl">{banner.title}</p>
          <span className="relative mt-2 text-sm font-semibold underline underline-offset-4">Ver productos</span>
        </Link>
      ))}
    </div>
  );
}
