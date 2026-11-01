import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { ForgotPasswordForm } from '@/components/account/recovery-forms';

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false, follow: false } };

export default function StaffForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{SITE.name}</h1>
        <p className="text-sm text-muted-foreground">Te enviamos un enlace a tu email para elegir una contraseña nueva</p>
      </div>
      <ForgotPasswordForm audience="staff" />
    </main>
  );
}
