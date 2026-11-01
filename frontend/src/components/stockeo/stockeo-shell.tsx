'use client';

import { BoxesIcon, LogOutIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLogout, useSession } from '@/lib/session';

const TABS = [
  { href: '/stockeo', label: 'Inicio', icon: BoxesIcon },
  { href: '/stockeo/nuevo', label: 'Nuevo producto', icon: PlusIcon },
] as const;

export function StockeoShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile } = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{profile?.branchName ?? 'Sucursal'}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.fullName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Cerrar sesión"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
        >
          <LogOutIcon />
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 pb-28 pt-4">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-md grid-cols-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
