'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CUSTOMER_SESSION_RENEWED } from '@/lib/api';
import { useCustomerSession } from '@/lib/customer-session';

/**
 * Mantiene viva la sesión del cliente. Si el access token venció y se renovó en el navegador, el servidor
 * (que renderizó como anónimo) vuelve a renderizar para mostrar los precios del cliente.
 */
export function AuthSync() {
  const router = useRouter();
  useCustomerSession();

  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(CUSTOMER_SESSION_RENEWED, refresh);
    return () => window.removeEventListener(CUSTOMER_SESSION_RENEWED, refresh);
  }, [router]);

  return null;
}
