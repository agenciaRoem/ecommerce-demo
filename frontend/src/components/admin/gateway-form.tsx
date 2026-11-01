'use client';

import { ExternalLinkIcon, Loader2Icon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/account/form-field';
import { Button } from '@/components/ui/button';
import { GatewayMode, GatewayPatch, GatewayView, useSaveGateway } from '@/lib/admin-payments';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const MERCADOPAGO_KEY = /^(APP_USR|TEST)-[A-Za-z0-9_-]{20,200}$/;
const CREDENTIALS_URL = 'https://www.mercadopago.com.ar/developers/panel/app';

const schema = z.object({
  accessToken: z.string().trim().refine((v) => v === '' || MERCADOPAGO_KEY.test(v), 'Debe empezar con APP_USR- o TEST-'),
  publicKey: z.string().trim().refine((v) => v === '' || MERCADOPAGO_KEY.test(v), 'Debe empezar con APP_USR- o TEST-'),
  webhookSecret: z
    .string()
    .trim()
    .refine((v) => v === '' || (v.length >= 16 && !/\s/.test(v)), 'Copiala completa, sin espacios'),
});

type Field = keyof z.infer<typeof schema>;
type Errors = Partial<Record<Field, string>>;

const MODES: { value: GatewayMode; label: string; hint: string }[] = [
  { value: 'SANDBOX', label: 'Pruebas', hint: 'Sin dinero real. Usá las credenciales de prueba y los usuarios de prueba de Mercado Pago.' },
  { value: 'PRODUCTION', label: 'Producción', hint: 'Cobros reales. Usá las credenciales de producción de tu aplicación.' },
];

/** Hint de un secreto guardado: se deja vacío para conservarlo. */
const savedHint = (has: boolean, hint: string | null) => (has ? `Guardado (${hint}). Dejalo vacío para conservarlo.` : undefined);

export function GatewayForm({ view }: { view: GatewayView }) {
  const save = useSaveGateway();
  const [mode, setMode] = useState<GatewayMode>(view.mode);
  const [values, setValues] = useState({ accessToken: '', publicKey: view.publicKey ?? '', webhookSecret: '' });
  const [errors, setErrors] = useState<Errors>({});

  const set = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      setErrors(next);
      return;
    }

    // Solo se envía lo que cambió: un secreto que se deja vacío se conserva.
    const patch: GatewayPatch = {};
    if (mode !== view.mode) patch.mode = mode;
    if (parsed.data.accessToken) patch.accessToken = parsed.data.accessToken;
    if (parsed.data.webhookSecret) patch.webhookSecret = parsed.data.webhookSecret;
    if (parsed.data.publicKey !== (view.publicKey ?? '')) patch.publicKey = parsed.data.publicKey;

    if (Object.keys(patch).length === 0) return void toast.info('No hay cambios para guardar');

    save.mutate(patch, {
      onSuccess: (updated) => {
        setValues({ accessToken: '', publicKey: updated.publicKey ?? '', webhookSecret: '' });
        toast.success(patch.accessToken ? `Conectado a la cuenta ${updated.account?.label ?? ''}` : 'Cambios guardados');
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : 'No se pudo guardar';
        if (error instanceof ApiError && error.status === 422) setErrors({ accessToken: message });
        else toast.error(message);
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl bg-white p-5 ring-1 ring-black/5" noValidate aria-labelledby="credentials-title">
      <div className="space-y-1">
        <h2 id="credentials-title" className="text-base font-bold">
          Credenciales
        </h2>
        <p className="text-sm text-muted-foreground">
          Las encontrás en{' '}
          <a href={CREDENTIALS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline">
            Mercado Pago Developers → Tus integraciones <ExternalLinkIcon className="size-3" aria-hidden />
          </a>{' '}
          (tu aplicación → Credenciales). Se guardan cifradas y nunca se vuelven a mostrar completas.
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Modo</legend>
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className={cn('rounded-xl border p-3 text-left transition hover:border-brand', mode === option.value && 'border-brand bg-brand-soft ring-1 ring-brand')}
          >
            <span className="block text-sm font-bold">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.hint}</span>
          </button>
        ))}
      </fieldset>

      <FormField
        id="mp-access-token"
        label="Access Token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="APP_USR-…"
        value={values.accessToken}
        onChange={(e) => set('accessToken')(e.target.value)}
        error={errors.accessToken}
        hint={savedHint(view.hasAccessToken, view.accessTokenHint) ?? 'Se valida con Mercado Pago antes de guardarse.'}
      />
      <FormField
        id="mp-public-key"
        label="Public Key (opcional)"
        autoComplete="off"
        spellCheck={false}
        placeholder="APP_USR-…"
        value={values.publicKey}
        onChange={(e) => set('publicKey')(e.target.value)}
        error={errors.publicKey}
        hint="No es secreta. La necesitará el checkout si se usan botones de pago dentro de la tienda."
      />
      <FormField
        id="mp-webhook-secret"
        label="Clave secreta del webhook"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={values.webhookSecret}
        onChange={(e) => set('webhookSecret')(e.target.value)}
        error={errors.webhookSecret}
        hint={savedHint(view.hasWebhookSecret, view.webhookSecretHint) ?? 'Webhooks → Configurar notificaciones → Clave secreta. Sirve para comprobar que cada aviso viene de Mercado Pago.'}
      />

      <Button type="submit" size="lg" className="h-11 w-full bg-brand text-white hover:bg-brand-dark sm:w-auto" disabled={save.isPending}>
        {save.isPending && <Loader2Icon className="animate-spin" />}
        Guardar y validar
      </Button>
    </form>
  );
}
