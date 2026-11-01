'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

/** Utilidades de presentación compartidas por las pantallas del backoffice. */

export const errorMessage = (error: unknown, fallback: string): string => (error instanceof ApiError ? error.message : fallback);

export const formatDateTime = (iso: string): string => new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDay = (iso: string): string => new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'medium' });

/** "AAAA-MM-DD" → "dd/mm" sin pasar por zonas horarias (es una fecha de calendario, no un instante). */
export const shortDay = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl bg-white p-4 ring-1 ring-black/5', className)}>
      {title && <h2 className="text-sm font-bold">{title}</h2>}
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className={cn(title && 'mt-3')}>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function LoadError({ children = 'No se pudo cargar. Probá de nuevo en un momento.' }: { children?: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
      {children}
    </p>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Paginación simple de "anteriores / siguientes" para los listados. */
export function Pager({ page, limit, total, onPage, disabled }: { page: number; limit: number; total: number; onPage: (page: number) => void; disabled?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-center gap-3 pt-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1 || disabled} onClick={() => onPage(page - 1)}>
        Anteriores
      </Button>
      <span>
        {page} de {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= pages || disabled} onClick={() => onPage(page + 1)}>
        Siguientes
      </Button>
    </nav>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children: ReactNode }) {
  const tones = {
    ok: 'bg-success-soft text-success',
    warn: 'bg-warning-soft text-warning',
    bad: 'bg-red-100 text-red-700',
    info: 'bg-brand-soft text-brand',
    muted: 'bg-muted text-muted-foreground',
  } as const;
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

/** Etiqueta + control, con el mensaje de error de ese campo si lo hay. */
export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Errores por campo que devuelve la API (`errors: [{ path, message }]`), listos para mostrar junto a cada control. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message]));
}

/** Las secciones de administración son solo del superadmin; el menú ya las oculta, esto cubre entrar por la dirección. */
export function SuperadminOnly({ children }: { children: ReactNode }) {
  const { data: profile } = useSession();
  if (!profile) return null;
  if (profile.role !== 'SUPERADMIN') return <EmptyState>Esta sección es solo para el superadmin.</EmptyState>;
  return <>{children}</>;
}
