'use client';

import {
  BarChart3Icon,
  BuildingIcon,
  ClipboardListIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  HistoryIcon,
  LogOutIcon,
  PackageIcon,
  PackagePlusIcon,
  ShieldAlertIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagsIcon,
  UsersIcon,
  PercentIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Role } from '@/lib/api-types';
import { usePaymentIssues } from '@/lib/backoffice/administration';
import { useLogout, useSession } from '@/lib/session';
import { SITE } from '@/lib/site';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles que la ven. El SUPERADMIN ve todo lo de gerencia además de lo suyo. */
  roles: readonly Role[];
  /** Solo coincide con la ruta exacta (para que "Resumen" no quede activo en todas). */
  exact?: boolean;
  /** Se abre en el panel propio de operaciones, fuera del backoffice. */
  external?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const MANAGEMENT = ['GERENTE', 'SUPERADMIN'] as const;

/** Secciones del backoffice. Sumar una es agregar una línea acá y su página bajo /admin. */
const NAV: NavGroup[] = [
  {
    title: 'Gerencia',
    items: [
      { href: '/admin', label: 'Resumen', icon: BarChart3Icon, roles: MANAGEMENT, exact: true },
      { href: '/admin/precios', label: 'Precios y costos', icon: TagsIcon, roles: MANAGEMENT },
      { href: '/admin/promociones', label: 'Promociones', icon: PercentIcon, roles: MANAGEMENT },
      { href: '/admin/carritos', label: 'Carritos abandonados', icon: ShoppingCartIcon, roles: MANAGEMENT },
    ],
  },
  {
    title: 'Administración',
    items: [
      { href: '/admin/sucursales', label: 'Sucursales', icon: BuildingIcon, roles: ['SUPERADMIN'] },
      { href: '/admin/personal', label: 'Personal', icon: UsersIcon, roles: ['SUPERADMIN'] },
      { href: '/admin/comercios', label: 'Comercios (CUIT)', icon: StoreIcon, roles: ['SUPERADMIN'] },
      { href: '/admin/incidencias', label: 'Pagos a revisar', icon: ShieldAlertIcon, roles: ['SUPERADMIN'] },
      { href: '/admin/pagos', label: 'Mercado Pago', icon: CreditCardIcon, roles: ['SUPERADMIN'] },
      { href: '/admin/auditoria', label: 'Auditoría', icon: HistoryIcon, roles: ['SUPERADMIN'] },
    ],
  },
  {
    title: 'Operación',
    items: [
      { href: '/sala', label: 'Pedidos de sala', icon: ClipboardListIcon, roles: MANAGEMENT, external: true },
      { href: '/encargado', label: 'Alta y edición de productos', icon: PackageIcon, roles: MANAGEMENT, external: true },
      { href: '/stockeo', label: 'Carga de stock', icon: PackagePlusIcon, roles: MANAGEMENT, external: true },
    ],
  },
];

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-brand-soft', active && 'bg-brand-soft text-brand')}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
      {badge !== undefined && badge > 0 && (
        <span data-testid="issues-badge" className="ml-auto rounded-full bg-sale px-1.5 text-[11px] font-bold leading-5 text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile } = useSession();
  const logout = useLogout();
  const role = profile?.role;
  const issues = usePaymentIssues(role === 'SUPERADMIN');

  const groups = NAV.map((group) => ({ ...group, items: group.items.filter((item) => role && item.roles.includes(role)) })).filter((group) => group.items.length > 0);
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 md:flex-row">
      <aside className="border-b bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:py-5">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-brand-dark">{SITE.name}</p>
            <p className="text-xs text-muted-foreground">Backoffice · {role === 'SUPERADMIN' ? 'Administración' : (profile?.branchName ?? 'Gerencia')}</p>
          </div>
          <Link href="/" target="_blank" className="flex items-center gap-1 text-xs font-medium text-brand md:mt-3">
            Ver la tienda <ExternalLinkIcon className="size-3" aria-hidden />
          </Link>
        </div>
        <nav aria-label="Secciones del backoffice" className="flex gap-4 overflow-x-auto px-2 pb-2 md:flex-col md:gap-3 md:pb-4">
          {groups.map((group) => (
            <div key={group.title} className="flex shrink-0 items-center gap-1 md:flex-col md:items-stretch">
              <p className="hidden px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:block">{group.title}</p>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item)} badge={item.href === '/admin/incidencias' ? issues.data?.length : undefined} />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b bg-white px-4 py-2">
          <p className="truncate text-sm text-muted-foreground">{profile?.fullName}</p>
          <Button variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}>
            <LogOutIcon /> Salir
          </Button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
