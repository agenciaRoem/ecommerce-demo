import Link from 'next/link';

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <h1 className="text-xl font-bold">No encontramos lo que buscabas</h1>
      <p className="text-sm text-muted-foreground">El producto o la página ya no existen, o el enlace es incorrecto.</p>
      <Link href="/productos" className="text-sm font-semibold text-brand underline underline-offset-4">
        Ver todos los productos
      </Link>
    </div>
  );
}
