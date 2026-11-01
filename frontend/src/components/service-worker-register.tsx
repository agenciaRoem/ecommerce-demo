'use client';

import { useEffect } from 'react';

/** Registra el service worker (requisito para instalar la PWA). Solo en producción. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
  }, []);
  return null;
}
