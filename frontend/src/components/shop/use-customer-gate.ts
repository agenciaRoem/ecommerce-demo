'use client';

import { useCustomerSession } from '@/lib/customer-session';
import { useHydrated } from '@/lib/hooks';

/**
 * Estado de la sesión del cliente para pantallas que la exigen.
 *  - `loading`: todavía se está comprobando (o se está hidratando la página);
 *  - `signedOut`: no hay sesión válida;
 *  - `signedIn`: hay sesión.
 * Hasta hidratar siempre devuelve `loading`, para que el primer render coincida con el del servidor.
 */
export function useCustomerGate(): 'loading' | 'signedOut' | 'signedIn' {
  const hydrated = useHydrated();
  const session = useCustomerSession();
  if (!hydrated) return 'loading';
  if (session.data) return 'signedIn';
  // Una consulta deshabilitada (sin marca de sesión) queda "pendiente" para siempre: lo que importa es que no esté buscando.
  return session.fetchStatus === 'idle' ? 'signedOut' : 'loading';
}
