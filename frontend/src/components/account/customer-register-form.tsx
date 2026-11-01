'use client';

import { Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { CustomerType } from '@/lib/catalog-types';
import { formatCuit, isValidCuit, normalizeCuit } from '@/lib/cuit';
import { RegisterInput, useCustomerRegister } from '@/lib/customer-session';
import { loginHref } from '@/lib/return-path';
import { cn } from '@/lib/utils';
import { FormField } from './form-field';

const baseSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre y apellido').max(120),
  email: z.string().trim().toLowerCase().email('Ingresá un email válido'),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(128),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{6,20}$/, 'Teléfono inválido')
    .or(z.literal('')),
});

const commerceSchema = baseSchema.extend({
  businessName: z.string().trim().min(2, 'Ingresá la razón social o nombre del comercio').max(160),
  cuit: z.string().refine(isValidCuit, 'El CUIT no es válido. Revisá los 11 dígitos.'),
  shippingAddress: z.string().trim().min(5, 'Ingresá una dirección completa').max(200).or(z.literal('')),
});

type Values = Record<'fullName' | 'email' | 'password' | 'phone' | 'businessName' | 'cuit' | 'shippingAddress', string>;
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { fullName: '', email: '', password: '', phone: '', businessName: '', cuit: '', shippingAddress: '' };

const TYPES: { value: CustomerType; label: string; hint: string }[] = [
  { value: 'RETAIL', label: 'Soy particular', hint: 'Compras para vos, con retiro en sucursal.' },
  { value: 'COMMERCE', label: 'Tengo un comercio', hint: 'Precios mayoristas con CUIT verificado y envío a domicilio.' },
];

export function CustomerRegisterForm({ initialType, returnTo }: { initialType: CustomerType; returnTo: string }) {
  const router = useRouter();
  const register = useCustomerRegister();
  const [type, setType] = useState<CustomerType>(initialType);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const commerce = type === 'COMMERCE';

  const set = (field: keyof Values) => (value: string) => {
    setValues((current) => ({ ...current, [field]: field === 'cuit' ? formatCuit(value) : value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = (commerce ? commerceSchema : baseSchema).safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Values] ??= issue.message;
      setErrors(next);
      return;
    }

    const data = parsed.data as Values;
    const common = { email: data.email, password: data.password, fullName: data.fullName, ...(data.phone && { phone: data.phone }) };
    const input: RegisterInput = commerce
      ? {
          type: 'COMMERCE',
          ...common,
          businessName: data.businessName,
          cuit: normalizeCuit(data.cuit),
          ...(data.shippingAddress && { shippingAddress: data.shippingAddress }),
        }
      : { type: 'RETAIL', ...common };

    register.mutate(input, {
      onSuccess: () => {
        router.replace(returnTo);
        router.refresh();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          const field: keyof Values = /cuit/i.test(error.message) ? 'cuit' : 'email';
          setErrors({ [field]: error.message });
        } else if (error instanceof ApiError && error.status === 429) {
          setFormError('Demasiados intentos. Esperá un minuto e intentá de nuevo.');
        } else {
          setFormError('No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.');
        }
      },
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Tipo de cuenta</legend>
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={type === option.value}
            onClick={() => setType(option.value)}
            className={cn(
              'rounded-xl border p-3 text-left transition hover:border-brand',
              type === option.value && 'border-brand bg-brand-soft ring-1 ring-brand',
            )}
          >
            <span className="block text-sm font-bold">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.hint}</span>
          </button>
        ))}
      </fieldset>

      <FormField id="fullName" label="Nombre y apellido" autoComplete="name" value={values.fullName} onChange={(e) => set('fullName')(e.target.value)} error={errors.fullName} />

      {commerce && (
        <>
          <FormField id="businessName" label="Razón social o nombre del comercio" autoComplete="organization" value={values.businessName} onChange={(e) => set('businessName')(e.target.value)} error={errors.businessName} />
          <FormField
            id="cuit"
            label="CUIT"
            inputMode="numeric"
            placeholder="30-12345678-9"
            value={values.cuit}
            onChange={(e) => set('cuit')(e.target.value)}
            error={errors.cuit}
            hint="Lo verificamos antes de habilitar los precios mayoristas. Mientras tanto comprás como minorista."
          />
        </>
      )}

      <FormField id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} />
      <FormField id="phone" label="Teléfono (opcional)" type="tel" autoComplete="tel" value={values.phone} onChange={(e) => set('phone')(e.target.value)} error={errors.phone} />
      {commerce && (
        <FormField id="shippingAddress" label="Dirección de entrega (opcional)" autoComplete="street-address" value={values.shippingAddress} onChange={(e) => set('shippingAddress')(e.target.value)} error={errors.shippingAddress} />
      )}
      <FormField id="password" label="Contraseña" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set('password')(e.target.value)} error={errors.password} hint="Mínimo 10 caracteres." />

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-12 w-full bg-brand text-base text-white hover:bg-brand-dark" disabled={register.isPending}>
        {register.isPending && <Loader2Icon className="animate-spin" />}
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href={loginHref(returnTo)} className="font-semibold text-brand underline-offset-4 hover:underline">
          Ingresá
        </Link>
      </p>
    </form>
  );
}
