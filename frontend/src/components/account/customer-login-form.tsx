'use client';

import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useCustomerLogin, useCustomerSession } from '@/lib/customer-session';
import { registerHref } from '@/lib/return-path';
import { FormField } from './form-field';
import { GoogleButton } from './google-button';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Demasiados intentos. Esperá un minuto e intentá de nuevo.';
    if (error.status === 401) return 'Email o contraseña incorrectos.';
  }
  return 'No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.';
}

/** `returnTo`: adónde volver al ingresar (ruta interna ya validada por la página). */
export function CustomerLoginForm({ returnTo, googleError = false }: { returnTo: string; googleError?: boolean }) {
  const router = useRouter();
  const session = useCustomerSession();
  const login = useCustomerLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (session.data) router.replace(returnTo);
  }, [session.data, router, returnTo]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          router.replace(returnTo);
          router.refresh(); // el servidor vuelve a renderizar con los precios del cliente
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {googleError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          No pudimos ingresar con Google. Probá de nuevo o usá tu email y contraseña.
        </p>
      )}
      <GoogleButton returnTo={returnTo} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField id="email" label="Email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <FormField id="password" label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {login.isError && (
          <p role="alert" className="text-sm text-destructive">
            {messageFor(login.error)}
          </p>
        )}

        <p className="text-right text-sm">
          <Link href="/cuenta/olvide-contrasena" className="font-medium text-brand underline-offset-4 hover:underline">
            Olvidé mi contraseña
          </Link>
        </p>

        <Button type="submit" size="lg" className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark" disabled={login.isPending || !email || !password}>
          {login.isPending && <Loader2Icon className="animate-spin" />}
          Ingresar
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Primera vez?{' '}
          <Link href={registerHref(returnTo)} className="font-semibold text-brand underline-offset-4 hover:underline">
            Creá tu cuenta
          </Link>
        </p>
      </form>
    </div>
  );
}
