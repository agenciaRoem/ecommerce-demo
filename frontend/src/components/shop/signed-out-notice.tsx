import Link from 'next/link';
import { loginHref, registerHref } from '@/lib/return-path';

/** Pantallas de compra para quien todavía no ingresó: invita a ingresar y vuelve acá. */
export function SignedOutNotice({ returnTo, what }: { returnTo: string; what: string }) {
  return (
    <div className="space-y-4 rounded-xl bg-white p-8 text-center ring-1 ring-black/5">
      <p className="font-semibold">Ingresá para ver {what}</p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href={loginHref(returnTo)} className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark">
          Ingresar
        </Link>
        <Link href={registerHref(returnTo)} className="rounded-lg px-5 py-2.5 font-semibold text-brand ring-1 ring-brand hover:bg-brand-soft">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
