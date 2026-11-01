'use client';

import { ArrowLeftIcon, LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/lib/session';
import { SITE } from '@/lib/site';

/** Marco de la pantalla de productos: la usa el encargado de stock, y gerencia como atajo. */
export function EncargadoShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: profile } = useSession();
  const logout = useLogout();
  const managesBackoffice = profile?.role === 'GERENTE' || profile?.role === 'SUPERADMIN';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex items-center justify-between gap-3 border-b bg-white px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-base font-extrabold tracking-tight text-brand-dark">{SITE.name}</p>
          <p className="truncate text-xs text-muted-foreground">Productos · {profile?.fullName}</p>
        </div>
        <div className="flex items-center gap-1">
          {managesBackoffice && (
            <Link href="/admin" className="flex items-center gap-1 px-2 text-sm font-medium text-brand">
              <ArrowLeftIcon className="size-4" aria-hidden /> Backoffice
            </Link>
          )}
          <Button variant="ghost" size="icon-lg" aria-label="Cerrar sesión" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}>
            <LogOutIcon />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">{children}</main>
    </div>
  );
}
