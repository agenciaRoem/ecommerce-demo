import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ContinueAfterSignIn } from '@/components/account/continue-after-sign-in';
import { Container } from '@/components/store/container';
import { safeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: 'Ingresando…', robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Destino de la vuelta desde Google: deja lista la sesión en el navegador y sigue hacia donde iba el cliente. */
export default function ContinuePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="max-w-md py-16">
      <Suspense>
        <Next searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Next({ searchParams }: { searchParams: SearchParams }) {
  return <ContinueAfterSignIn next={safeReturnPath((await searchParams).next)} />;
}
