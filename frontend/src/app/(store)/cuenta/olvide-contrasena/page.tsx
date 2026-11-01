import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/account/recovery-forms';
import { Container } from '@/components/store/container';

export const metadata: Metadata = { title: 'Recuperar mi contraseña', robots: { index: false, follow: false } };

export default function CustomerForgotPasswordPage() {
  return (
    <Container className="max-w-md space-y-6 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Recuperá tu contraseña</h1>
        <p className="text-sm text-muted-foreground">Ingresá el email de tu cuenta y te enviamos un enlace para elegir una nueva.</p>
      </div>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <ForgotPasswordForm audience="customer" />
      </div>
    </Container>
  );
}
