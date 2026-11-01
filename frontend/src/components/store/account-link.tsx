'use client';

import { UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useCustomerSession } from '@/lib/customer-session';
import { useHydrated } from '@/lib/hooks';

export function AccountLink() {
  const hydrated = useHydrated();
  const session = useCustomerSession();
  // Hasta hidratar se muestra lo mismo que renderizó el servidor (anónimo).
  const customer = hydrated ? session.data : undefined;
  const firstName = customer?.fullName.split(' ')[0];

  return (
    <Link
      href={customer ? '/cuenta' : '/cuenta/ingresar'}
      className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium hover:bg-brand-soft"
    >
      <UserIcon className="size-6" aria-hidden />
      <span className="hidden max-w-32 truncate sm:inline">{firstName ? `Hola, ${firstName}` : 'Mi cuenta'}</span>
      <span className="sr-only sm:hidden">{customer ? 'Mi cuenta' : 'Ingresar'}</span>
    </Link>
  );
}
