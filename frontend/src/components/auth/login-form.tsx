'use client';

import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { homeFor, useLogin, useSession } from '@/lib/session';

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    if (error.status === 401) return 'Email o contraseña incorrectos.';
    if (error.status === 400) return 'Revisa el email y la contraseña.';
  }
  return 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.';
}

export function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Si ya hay una sesión válida, no se pide el login otra vez.
  useEffect(() => {
    if (session.data) router.replace(homeFor(session.data.role));
  }, [session.data, router]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email: email.trim(), password }, { onSuccess: (profile) => router.replace(homeFor(profile.role)) });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          className="h-12 text-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-12 text-base"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {login.isError && (
        <p role="alert" className="text-sm text-destructive">
          {messageFor(login.error)}
        </p>
      )}

      <p className="text-right text-sm">
        <Link href="/recuperar" className="font-medium underline-offset-4 hover:underline">
          Olvidé mi contraseña
        </Link>
      </p>

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={login.isPending || !email || !password}>
        {login.isPending && <Loader2Icon className="animate-spin" />}
        Ingresar
      </Button>
    </form>
  );
}
