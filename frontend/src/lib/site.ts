/** Identidad y contenido editorial de la tienda. Un único lugar para rebrandear o cambiar banners. */

export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? 'ROEM-edemo',
  tagline: 'Papelería, librería y útiles para toda la familia',
  phone: '0800 000 0000',
  email: 'ventas@omnistock.local',
  hours: 'Lun a Vie de 9 a 18 h · Sáb de 9 a 13 h',
} as const;

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string };
  /** Clases de Tailwind del fondo del slide. */
  background: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'clases',
    eyebrow: 'Vuelta a clases',
    title: 'Todo para el cole, con hasta 20% OFF',
    text: 'Cuadernos, mochilas, lápices y más. Retiralo en la sucursal que elijas.',
    cta: { label: 'Ver útiles escolares', href: '/productos?category=utiles-escolares' },
    background: 'from-brand-dark via-brand to-sky-500',
  },
  {
    id: 'mayoristas',
    eyebrow: 'Para comercios',
    title: 'Precios mayoristas para tu negocio',
    text: 'Registrá tu comercio con el CUIT y accedé a la lista mayorista y al envío a domicilio.',
    cta: { label: 'Registrar mi comercio', href: '/cuenta/registro?tipo=comercio' },
    background: 'from-slate-900 via-indigo-900 to-violet-700',
  },
  {
    id: 'oficina',
    eyebrow: 'Oficina',
    title: 'Resmas, biblioratos y todo lo que necesitás',
    text: 'Equipá tu oficina con stock real en cada sucursal.',
    cta: { label: 'Ver oficina', href: '/productos?category=oficina' },
    background: 'from-emerald-700 via-teal-600 to-cyan-500',
  },
];

export interface PromoBanner {
  id: string;
  kicker: string;
  title: string;
  href: string;
  background: string;
}

export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: 'ofertas',
    kicker: 'Aprovechá',
    title: 'Ofertas de la semana',
    href: '/productos?onSale=true',
    background: 'from-rose-500 to-orange-400',
  },
  {
    id: 'arte',
    kicker: 'Creá y jugá',
    title: 'Arte y manualidades',
    href: '/productos?category=arte-y-manualidades',
    background: 'from-violet-600 to-fuchsia-500',
  },
];

export const BENEFITS = [
  { id: 'pago', title: 'Pagá como quieras', text: 'Tarjetas de crédito, débito y transferencia.' },
  { id: 'mayorista', title: 'Precios para comercios', text: 'Lista mayorista con CUIT verificado.' },
  { id: 'retiro', title: 'Retiro gratis en sucursal', text: 'Con el stock real de cada local.' },
] as const;

export const SERVICE_LINKS = [
  { label: 'Seguí tu compra', href: '/cuenta' },
  { label: 'Sucursales', href: '/sucursales' },
  { label: 'Venta mayorista', href: '/cuenta/registro?tipo=comercio' },
] as const;
