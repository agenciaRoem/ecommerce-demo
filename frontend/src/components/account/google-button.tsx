'use client';

import { API_URL } from '@/lib/api';
import { useAuthProviders } from '@/lib/account-recovery';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * "Continuar con Google". Solo aparece si la tienda lo tiene habilitado. Es un enlace común: el navegador sale
 * hacia la API, que lo manda a Google y, al volver, abre la sesión y regresa a `returnTo`.
 */
export function GoogleButton({ returnTo, label = 'Continuar con Google' }: { returnTo: string; label?: string }) {
  const providers = useAuthProviders();
  if (!providers.data?.google) return null;

  return (
    <div className="space-y-4">
      <a
        href={`${API_URL}/customers/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-white text-base font-medium hover:bg-muted"
      >
        <GoogleMark /> {label}
      </a>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> o con tu email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
