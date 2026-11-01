'use client';

import { CheckCircle2Icon, Loader2Icon, MailCheckIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { RecoveryAudience, useForgotPassword, useResetPassword, useVerifyEmail } from '@/lib/account-recovery';
import { useEffect } from 'react';
import { FormField } from './form-field';

/** Adónde llevan los enlaces de cada tipo de cuenta. */
const PAGES: Record<RecoveryAudience, { login: string; forgot: string }> = {
  customer: { login: '/cuenta/ingresar', forgot: '/cuenta/olvide-contrasena' },
  staff: { login: '/login', forgot: '/recuperar' },
};

const MIN_PASSWORD = 10;

const primaryButton = 'h-12 w-full bg-brand text-base text-white hover:bg-brand-dark';

/** Pide el email. Siempre muestra el mismo mensaje: no se revela quién tiene cuenta. */
export function ForgotPasswordForm({ audience }: { audience: RecoveryAudience }) {
  const forgot = useForgotPassword(audience);
  const [email, setEmail] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    forgot.mutate(email.trim());
  }

  if (forgot.isSuccess) {
    return (
      <div className="space-y-4 text-center" role="status">
        <MailCheckIcon className="mx-auto size-10 text-brand" aria-hidden />
        <h2 className="text-lg font-bold">Revisá tu correo</h2>
        <p className="text-sm text-muted-foreground">
          Si hay una cuenta con <b>{email.trim()}</b>, te enviamos un enlace para elegir una contraseña nueva. Vale 1 hora. Mirá también la carpeta de spam.
        </p>
        <Link href={PAGES[audience].login} className="inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField id="email" label="Email de tu cuenta" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {forgot.isError && (
        <p role="alert" className="text-sm text-destructive">
          {forgot.error instanceof ApiError && forgot.error.status === 429 ? 'Hiciste muchos pedidos seguidos. Esperá un minuto e intentá de nuevo.' : 'No pudimos enviar el correo. Intentá de nuevo en un momento.'}
        </p>
      )}
      <Button type="submit" size="lg" className={primaryButton} disabled={forgot.isPending || !email.trim()}>
        {forgot.isPending && <Loader2Icon className="animate-spin" />}
        Enviarme el enlace
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href={PAGES[audience].login} className="font-semibold text-brand underline-offset-4 hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}

/** Elige la contraseña nueva con el token del enlace del correo. */
export function ResetPasswordForm({ audience, token }: { audience: RecoveryAudience; token: string }) {
  const reset = useResetPassword(audience);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const tooShort = password.length < MIN_PASSWORD;
  const mismatch = password !== confirm;
  const invalidLink = reset.error instanceof ApiError && reset.error.status === 400 && !reset.error.issues.length;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (tooShort || mismatch) return;
    reset.mutate({ token, password });
  }

  if (reset.isSuccess) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2Icon className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="text-lg font-bold">Contraseña actualizada</h2>
        <p className="text-sm text-muted-foreground">Cerramos tus sesiones abiertas por seguridad. Ingresá con tu contraseña nueva.</p>
        <Link href={PAGES[audience].login} className="inline-flex h-11 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark">
          Ingresar
        </Link>
      </div>
    );
  }

  if (invalidLink) {
    return (
      <div className="space-y-4 text-center" role="alert">
        <TriangleAlertIcon className="mx-auto size-10 text-warning" aria-hidden />
        <h2 className="text-lg font-bold">El enlace no sirve</h2>
        <p className="text-sm text-muted-foreground">Venció o ya se usó. Cada enlace vale 1 hora y funciona una sola vez.</p>
        <Link href={PAGES[audience].forgot} className="inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        id="password"
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
        error={touched && tooShort ? `Usá al menos ${MIN_PASSWORD} caracteres.` : undefined}
      />
      <FormField
        id="confirm"
        label="Repetí la contraseña"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={touched && mismatch ? 'Las contraseñas no coinciden.' : undefined}
      />
      {reset.isError && (
        <p role="alert" className="text-sm text-destructive">
          No pudimos cambiar la contraseña. Intentá de nuevo.
        </p>
      )}
      <Button type="submit" size="lg" className={primaryButton} disabled={reset.isPending}>
        {reset.isPending && <Loader2Icon className="animate-spin" />}
        Guardar contraseña
      </Button>
    </form>
  );
}

/** Se abre al tocar el enlace del correo de verificación: confirma el email apenas carga la pantalla. */
export function VerifyEmailResult({ token }: { token: string }) {
  const verify = useVerifyEmail();
  const sent = useRef(false);

  // El enlace es de un solo uso: en desarrollo React ejecuta los efectos dos veces y el segundo intento fallaría.
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    verify.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se confirma una sola vez por carga
  }, [token]);

  if (verify.isPending || verify.isIdle) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground" role="status">
        <Loader2Icon className="size-4 animate-spin" aria-hidden /> Confirmando tu email…
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2Icon className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="text-lg font-bold">¡Email confirmado!</h2>
        <p className="text-sm text-muted-foreground">Ya podés comprar y, si olvidás tu contraseña, recuperarla desde tu correo.</p>
        <Link href="/productos" className="inline-flex h-11 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center" role="alert">
      <TriangleAlertIcon className="mx-auto size-10 text-warning" aria-hidden />
      <h2 className="text-lg font-bold">El enlace no sirve</h2>
      <p className="text-sm text-muted-foreground">Venció o ya se usó. Ingresá a tu cuenta y pedí que te lo enviemos de nuevo.</p>
      <Link href="/cuenta" className="inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline">
        Ir a mi cuenta
      </Link>
    </div>
  );
}
