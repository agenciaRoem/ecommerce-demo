'use client';

import { Loader2Icon, MailWarningIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useResendVerification } from '@/lib/account-recovery';
import { ApiError } from '@/lib/api';

/** Aviso para quien todavía no confirmó su email: sin eso no puede comprar. Permite pedir el correo de nuevo. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const resend = useResendVerification();

  function onResend() {
    resend.mutate(undefined, {
      onSuccess: () => toast.success('Listo, te enviamos el correo de nuevo. Puede tardar unos minutos.'),
      onError: (error) => toast.error(error instanceof ApiError && error.status === 429 ? 'Ya pediste varios correos. Probá más tarde.' : 'No pudimos enviar el correo. Probá de nuevo.'),
    });
  }

  return (
    <div role="status" data-testid="verify-email-banner" className="flex flex-wrap items-start gap-3 rounded-xl bg-warning-soft p-4 text-sm text-warning">
      <MailWarningIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">Confirmá tu email para poder comprar</p>
        <p>
          Te enviamos un enlace a <b className="break-all">{email}</b>. Mirá también la carpeta de spam.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onResend} disabled={resend.isPending || resend.isSuccess}>
        {resend.isPending && <Loader2Icon className="animate-spin" />}
        {resend.isSuccess ? 'Enviado' : 'Reenviar correo'}
      </Button>
    </div>
  );
}
