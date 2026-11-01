import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailResult } from '@/components/account/recovery-forms';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Confirmar mi email', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="max-w-md space-y-6 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Confirmar mi email</h1>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <Suspense>
          <Result searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Result({ searchParams }: { searchParams: SearchParams }) {
  const token = (await searchParams).token;
  return typeof token === 'string' && token ? <VerifyEmailResult token={token} /> : <p className="text-sm text-muted-foreground">Falta el enlace del correo.</p>;
}
