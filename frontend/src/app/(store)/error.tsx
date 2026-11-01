'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Pantalla de error de la tienda: casi siempre es la API que no responde. */
export default function StoreError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-xl font-bold">No pudimos cargar esta página</h1>
      <p className="text-sm text-muted-foreground">Puede ser un problema momentáneo de conexión. Probá de nuevo en unos segundos.</p>
      <div className="flex gap-2">
        <Button onClick={reset} className="bg-brand text-white hover:bg-brand-dark">
          Reintentar
        </Button>
        <Button variant="outline" render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
