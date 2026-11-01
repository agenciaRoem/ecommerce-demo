'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { Role } from '@/lib/api-types';
import { useLogout, useSession } from '@/lib/session';

/** Exige sesión y uno de los roles indicados. Sin sesión redirige al login. */
export function StaffGate({ allowed, children }: { allowed: Role[]; children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();

  useEffect(() => {
    if (session.isError) router.replace('/login');
  }, [session.isError, router]);

  if (!session.data) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!allowed.includes(session.data.role)) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Sin acceso a esta sección</h1>
        <p className="text-sm text-muted-foreground">
          No tenés permisos para esta pantalla. Ingresá con una cuenta que la tenga habilitada.
        </p>
        <Button variant="outline" onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}>
          Cambiar de cuenta
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
