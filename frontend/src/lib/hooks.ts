'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/**
 * `false` mientras el cliente hidrata el HTML del servidor y `true` desde entonces. Sirve para que lo
 * que depende del navegador (sesión, cookies) no se pinte hasta después de hidratar: así el primer render
 * del cliente coincide con el del servidor y React no detecta desajustes.
 */
export const useHydrated = (): boolean => useSyncExternalStore(subscribeNever, () => true, () => false);

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
