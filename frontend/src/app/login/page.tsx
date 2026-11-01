import type { Metadata } from 'next';
import { SITE } from '@/lib/site';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Ingresar' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{SITE.name}</h1>
        <p className="text-sm text-muted-foreground">Ingresa con tu cuenta de personal</p>
      </div>
      <LoginForm />
    </main>
  );
}
