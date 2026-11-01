import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/account/recovery-forms';

export const metadata: Metadata = { title: 'Elegir contraseña nueva', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function StaffResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{SITE.name}</h1>
        <p className="text-sm text-muted-foreground">Elegí tu contraseña nueva</p>
      </div>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: SearchParams }) {
  const token = (await searchParams).token;
  return typeof token === 'string' && token ? <ResetPasswordForm audience="staff" token={token} /> : <p className="text-sm text-muted-foreground">Falta el enlace del correo. Pedí uno nuevo desde «Olvidé mi contraseña».</p>;
}
