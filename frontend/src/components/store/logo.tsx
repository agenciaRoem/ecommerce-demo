import Link from 'next/link';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${SITE.name}, ir al inicio`} className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path d="M16 6 25 11v10l-9 5-9-5V11z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="m7 11 9 5 9-5M16 16v10" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-brand-dark">{SITE.name}</span>
    </Link>
  );
}
