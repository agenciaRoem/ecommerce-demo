import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CustomerLoginForm } from '@/components/account/customer-login-form';
import { Container } from '@/components/store/container';
import { safeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: 'Ingresar' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CustomerLoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="max-w-md space-y-6 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Ingresá a tu cuenta</h1>
        <p className="text-sm text-muted-foreground">Seguí tus compras y accedé a tus precios.</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <Suspense>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.volver);
  return <CustomerLoginForm key={returnTo} returnTo={returnTo} googleError={params.error === 'google'} />;
}
