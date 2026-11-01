'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardListIcon, LogOutIcon, PackagePlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/api';
import type { StoreBranch } from '@/lib/catalog-types';
import { useSummary } from '@/lib/sala-api';
import { useLogout, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { OperatingBranchProvider } from './branch-context';

/** Sucursales para el selector del SUPERADMIN (endpoint público). */
function useBranches(enabled: boolean) {
  return useQuery({
    queryKey: ['sala', 'branches'],
    queryFn: async () => (await (await fetch(`${API_URL}/catalog/branches`)).json()) as StoreBranch[],
    enabled,
    staleTime: 10 * 60_000,
  });
}

function Tab({ href, active, icon: Icon, children, badge }: { href: string; active: boolean; icon: typeof ClipboardListIcon; children: ReactNode; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-soft', active && 'bg-brand-soft text-brand')}
    >
      <Icon className="size-4" aria-hidden />
      {children}
      {badge !== undefined && badge > 0 && (
        <span data-testid="pending-badge" className="rounded-full bg-sale px-1.5 text-[11px] font-bold leading-5 text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function SalaShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile } = useSession();
  const logout = useLogout();
  const isSuperadmin = profile?.role === 'SUPERADMIN';

  // El SUPERADMIN no pertenece a una sucursal: elige sobre cuál trabaja. Los demás quedan fijados a la suya.
  const branches = useBranches(isSuperadmin);
  const [chosen, setChosen] = useState<string | null>(null);
  const branchId = isSuperadmin ? (chosen ?? branches.data?.[0]?.id) : undefined;
  const ready = !isSuperadmin || Boolean(branchId);
  const pending = useSummary(branchId).data?.PENDING;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b bg-white px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {isSuperadmin ? (
              <NativeSelect aria-label="Sucursal" className="h-10 w-56 text-sm font-semibold" value={branchId ?? ''} onChange={(e) => setChosen(e.target.value)}>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="truncate text-base font-extrabold">{profile?.branchName ?? 'Sucursal'}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">Operaciones · {profile?.fullName}</p>
          </div>

          <nav aria-label="Secciones" className="flex items-center gap-1">
            <Tab href="/sala" active={pathname === '/sala'} icon={ClipboardListIcon} badge={pending}>
              Pedidos
            </Tab>
            <Tab href="/sala/stock" active={pathname === '/sala/stock'} icon={SlidersHorizontalIcon}>
              Ajuste de stock
            </Tab>
            {profile?.role === 'GERENTE' && (
              <Tab href="/stockeo" active={false} icon={PackagePlusIcon}>
                Carga
              </Tab>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Cerrar sesión"
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
            >
              <LogOutIcon />
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        {ready ? <OperatingBranchProvider value={branchId}>{children}</OperatingBranchProvider> : <Skeleton className="h-64" />}
      </main>
    </div>
  );
}
