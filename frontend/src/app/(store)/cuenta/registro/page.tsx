import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CustomerRegisterForm } from '@/components/account/customer-register-form';
import { GoogleButton } from '@/components/account/google-button';
import { Container } from '@/components/store/container';
import { safeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: 'Crear cuenta' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function CustomerRegisterPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Container className="max-w-xl space-y-6 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Creá tu cuenta</h1>
        <p className="text-sm text-muted-foreground">Elegí cómo vas a comprar. Podés cambiar de opción antes de enviar.</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <Suspense>
          <RegisterForm searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}

async function RegisterForm({ searchParams }: { searchParams: SearchParams }) {
  const { tipo, volver } = await searchParams;
  const initialType = tipo === 'comercio' ? 'COMMERCE' : 'RETAIL';
  const returnTo = safeReturnPath(volver);
  // La key reinicia el formulario si cambia el tipo preseleccionado o el destino en la URL.
  return (
    <div className="space-y-4">
      <GoogleButton returnTo={returnTo} label="Registrarme con Google" />
      <CustomerRegisterForm key={`${initialType}:${returnTo}`} initialType={initialType} returnTo={returnTo} />
    </div>
  );
}
