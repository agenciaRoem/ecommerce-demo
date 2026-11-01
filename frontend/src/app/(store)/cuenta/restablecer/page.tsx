import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/account/recovery-forms';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Elegir contraseña nueva', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CustomerResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="max-w-md space-y-6 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Elegí tu contraseña nueva</h1>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const token = (await searchParams).token;
  return typeof token === 'string' && token ? <ResetPasswordForm audience="customer" token={token} /> : <p className="text-sm text-muted-foreground">Falta el enlace del correo. Pedí uno nuevo desde «Olvidé mi contraseña».</p>;
}
