import { cacheLife } from 'next/cache';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { Container } from './container';
import { Logo } from './logo';

const COLUMNS = [
  {
    title: 'Comprar',
    links: [
      { label: 'Todos los productos', href: '/productos' },
      { label: 'Ofertas', href: '/productos?onSale=true' },
      { label: 'Útiles escolares', href: '/productos?category=utiles-escolares' },
      { label: 'Oficina', href: '/productos?category=oficina' },
    ],
  },
  {
    title: 'Para comercios',
    links: [
      { label: 'Registrar mi comercio', href: '/cuenta/registro?tipo=comercio' },
      { label: 'Ingresar', href: '/cuenta/ingresar' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Sucursales', href: '/sucursales' },
      { label: 'Mi cuenta', href: '/cuenta' },
    ],
  },
] as const;

/** El año cambia una vez al año: se cachea por días en vez de calcularlo en cada render. */
async function CurrentYear() {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}

export function StoreFooter() {
  return (
    <footer className="mt-12 border-t bg-white">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{SITE.tagline}</p>
          <address className="space-y-1 text-sm not-italic">
            <p className="font-semibold">Atención al cliente</p>
            <p className="text-lg font-bold">{SITE.phone}</p>
            <p className="text-xs text-muted-foreground">{SITE.hours}</p>
            <p className="text-xs text-muted-foreground">{SITE.email}</p>
          </address>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-3 text-sm font-bold">{column.title}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © <CurrentYear /> {SITE.name}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
