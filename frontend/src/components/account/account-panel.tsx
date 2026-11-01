'use client';

import { BadgeCheckIcon, ClockIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerLogout, useCustomerSession } from '@/lib/customer-session';
import { useHydrated } from '@/lib/hooks';
import { VerifyEmailBanner } from './verify-email-banner';

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function AccountPanel() {
  const router = useRouter();
  const session = useCustomerSession();
  const logout = useCustomerLogout();
  const hydrated = useHydrated();
  // Hasta hidratar se muestra lo mismo que renderizó el servidor (el esqueleto de carga).
  const customer = hydrated ? session.data : undefined;

  // Una consulta deshabilitada (sin marca de sesión) queda "pendiente" para siempre: lo que importa es que
  // ya no esté buscando. Cubre tanto al visitante anónimo como a una sesión vencida.
  // Al cerrar sesión desde acá, el destino (el inicio) lo decide el botón, no esta redirección.
  const signedOut =
    hydrated && session.fetchStatus === 'idle' && !customer && !logout.isPending && !logout.isSuccess;

  useEffect(() => {
    if (signedOut) router.replace('/cuenta/ingresar');
  }, [signedOut, router]);

  if (!customer) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Hola, {customer.fullName.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">{customer.type === 'COMMERCE' ? 'Cuenta de comercio' : 'Cuenta de particular'}</p>
      </div>

      {!customer.emailVerified && <VerifyEmailBanner email={customer.email} />}

      {customer.type === 'COMMERCE' && (
        <div
          className={`flex items-start gap-3 rounded-xl p-4 text-sm ${customer.cuitVerified ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}
        >
          {customer.cuitVerified ? <BadgeCheckIcon className="mt-0.5 size-5 shrink-0" /> : <ClockIcon className="mt-0.5 size-5 shrink-0" />}
          <p>
            {customer.cuitVerified
              ? 'Tu CUIT está verificado: ves los precios mayoristas en todo el sitio.'
              : 'Estamos verificando tu CUIT. Mientras tanto ves los precios minoristas; te avisaremos cuando se habiliten los mayoristas.'}
          </p>
        </div>
      )}

      <dl className="divide-y rounded-xl bg-white px-4 py-2 ring-1 ring-black/5">
        <Row label="Nombre" value={customer.fullName} />
        <Row label="Email" value={customer.email} />
        <Row label="Teléfono" value={customer.phone} />
        <Row label="Comercio" value={customer.businessName} />
        <Row label="CUIT" value={customer.cuit} />
        <Row label="Dirección de entrega" value={customer.shippingAddress} />
      </dl>

      <Button render={<Link href="/pedidos" />} className="h-11 w-full bg-brand text-white hover:bg-brand-dark">
        Mis pedidos
      </Button>

      <Button
        variant="outline"
        className="h-11 w-full"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              router.replace('/');
              router.refresh();
            },
          })
        }
      >
        {logout.isPending && <Loader2Icon className="animate-spin" />}
        Cerrar sesión
      </Button>
    </div>
  );
}
