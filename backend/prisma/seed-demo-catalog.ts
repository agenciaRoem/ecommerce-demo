import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

/**
 * Catálogo de demostración (solo desarrollo): productos con imágenes dibujadas, stock por sucursal y
 * promociones. Es idempotente: vuelve a correr sin duplicar. Las imágenes siguen el mismo formato que
 * la API de subida (3 variantes WebP bajo `products/<uuid>/`).
 */

type Icon = 'notebook' | 'pencil' | 'folder' | 'palette' | 'ruler' | 'box';

interface DemoProduct {
  sku: string;
  name: string;
  category: string;
  cost: number;
  icon: Icon;
  color: string;
  /** Stock en CEN, NOR y SUR. */
  stock: [number, number, number];
  description: string;
}

const PRODUCTS: DemoProduct[] = [
  { sku: 'DEMO-001', name: 'Cuaderno Rivadavia A4 rayado 84 hojas', category: 'utiles-escolares', cost: 2400, icon: 'notebook', color: '#2563eb', stock: [40, 25, 12], description: 'Tapa dura, hojas de 80 g, espiral reforzado.' },
  { sku: 'DEMO-002', name: 'Cuaderno Gloria 16x21 cuadriculado 48 hojas', category: 'utiles-escolares', cost: 1300, icon: 'notebook', color: '#16a34a', stock: [60, 30, 0], description: 'Ideal para la mochila. Hojas cuadriculadas 7 mm.' },
  { sku: 'DEMO-003', name: 'Lápiz negro HB Faber-Castell x12', category: 'utiles-escolares', cost: 3100, icon: 'pencil', color: '#f59e0b', stock: [30, 18, 9], description: 'Caja de 12 lápices de grafito, mina resistente.' },
  { sku: 'DEMO-004', name: 'Lapicera azul Bic Cristal x12', category: 'utiles-escolares', cost: 4200, icon: 'pencil', color: '#0ea5e9', stock: [4, 22, 15], description: 'Trazo suave de tinta azul, punta media 1 mm.' },
  { sku: 'DEMO-005', name: 'Mochila escolar reforzada 18 litros', category: 'utiles-escolares', cost: 21000, icon: 'box', color: '#7c3aed', stock: [8, 5, 3], description: 'Dos compartimentos, bolsillo lateral y espalda acolchada.' },
  { sku: 'DEMO-006', name: 'Regla acrílica 30 cm transparente', category: 'utiles-escolares', cost: 700, icon: 'ruler', color: '#06b6d4', stock: [100, 50, 40], description: 'Graduada en centímetros y milímetros.' },
  { sku: 'DEMO-007', name: 'Carpeta N°3 anillos tapa dura', category: 'utiles-escolares', cost: 5600, icon: 'folder', color: '#dc2626', stock: [20, 14, 6], description: 'Cuatro anillos, lomo de 5 cm.' },
  { sku: 'DEMO-008', name: 'Resma A4 Autor 75 g x500 hojas', category: 'oficina', cost: 6900, icon: 'box', color: '#64748b', stock: [90, 70, 55], description: 'Papel multifunción para impresora y fotocopiadora.' },
  { sku: 'DEMO-009', name: 'Resma oficio 75 g x500 hojas', category: 'oficina', cost: 8200, icon: 'box', color: '#475569', stock: [45, 30, 18], description: 'Papel oficio multifunción.' },
  { sku: 'DEMO-010', name: 'Biblioratos A4 lomo ancho x3', category: 'oficina', cost: 9800, icon: 'folder', color: '#0f766e', stock: [25, 12, 0], description: 'Pack de tres, con ojal metálico y palanca.' },
  { sku: 'DEMO-011', name: 'Abrochadora metálica 24/6', category: 'oficina', cost: 6400, icon: 'box', color: '#ea580c', stock: [15, 9, 7], description: 'Capacidad para 25 hojas. Incluye grampas.' },
  { sku: 'DEMO-012', name: 'Calculadora científica 240 funciones', category: 'oficina', cost: 13500, icon: 'box', color: '#1e293b', stock: [10, 6, 2], description: 'Pantalla de dos líneas, alimentación solar.' },
  { sku: 'DEMO-013', name: 'Marcadores permanentes colores x6', category: 'oficina', cost: 4800, icon: 'pencil', color: '#db2777', stock: [34, 20, 11], description: 'Punta redonda, tinta de secado rápido.' },
  { sku: 'DEMO-014', name: 'Set de acuarelas 24 colores con pincel', category: 'arte-y-manualidades', cost: 8700, icon: 'palette', color: '#e11d48', stock: [18, 10, 6], description: 'Pastillas de colores vivos para escuela y arte.' },
  { sku: 'DEMO-015', name: 'Témperas escolares 6 colores x 25 ml', category: 'arte-y-manualidades', cost: 4900, icon: 'palette', color: '#f97316', stock: [26, 16, 8], description: 'Lavables, no tóxicas, certificadas para uso infantil.' },
  { sku: 'DEMO-016', name: 'Plasticola 250 g adhesivo vinílico', category: 'arte-y-manualidades', cost: 1800, icon: 'box', color: '#84cc16', stock: [70, 45, 30], description: 'Adhesivo blanco lavable para papel y cartón.' },
  { sku: 'DEMO-017', name: 'Block de dibujo N°5 x24 hojas', category: 'arte-y-manualidades', cost: 2900, icon: 'notebook', color: '#a855f7', stock: [33, 21, 14], description: 'Hojas blancas de 120 g para dibujo y collage.' },
  { sku: 'DEMO-018', name: 'Pinceles surtidos x10', category: 'arte-y-manualidades', cost: 3600, icon: 'pencil', color: '#14b8a6', stock: [5, 8, 4], description: 'Set de diez pinceles de distintos grosores.' },
  { sku: 'DEMO-019', name: 'Cartulina de colores x10 pliegos', category: 'arte-y-manualidades', cost: 3300, icon: 'folder', color: '#eab308', stock: [28, 17, 0], description: 'Pliegos de 50x70 cm en colores surtidos.' },
  { sku: 'DEMO-020', name: 'Agenda 2027 semana a la vista', category: 'papeleria', cost: 9900, icon: 'notebook', color: '#be123c', stock: [22, 15, 10], description: 'Tapa flexible, cinta marcadora y elástico.' },
  { sku: 'DEMO-021', name: 'Sobres blancos americanos x100', category: 'papeleria', cost: 3500, icon: 'box', color: '#0284c7', stock: [38, 25, 20], description: 'Con autoadhesivo, 11 x 22,5 cm.' },
  { sku: 'DEMO-022', name: 'Notas autoadhesivas 76x76 mm x100', category: 'papeleria', cost: 2100, icon: 'notebook', color: '#facc15', stock: [75, 60, 44], description: 'Cinco colores neón, adhesivo removible.' },
  { sku: 'DEMO-023', name: 'Papel de regalo kraft rollo 5 m', category: 'papeleria', cost: 1900, icon: 'folder', color: '#b45309', stock: [3, 12, 9], description: 'Papel reciclado, ideal para decorar.' },
  { sku: 'DEMO-024', name: 'Etiquetas adhesivas blancas A4 x100', category: 'papeleria', cost: 4400, icon: 'ruler', color: '#4f46e5', stock: [16, 9, 5], description: 'Hojas para impresora láser y chorro de tinta.' },
];

const BRANCH_ORDER = ['CEN', 'NOR', 'SUR'] as const;
const VARIANTS = { thumb: 200, card: 600, detail: 1200 } as const;

const ICONS: Record<Icon, string> = {
  notebook: `<rect x="300" y="220" width="400" height="560" rx="28" fill="#fff"/>
    <rect x="300" y="220" width="70" height="560" rx="28" fill="rgba(0,0,0,.18)"/>
    ${[300, 380, 460, 540, 620, 700].map((y) => `<circle cx="335" cy="${y}" r="13" fill="#fff"/>`).join('')}
    ${[340, 420, 500, 580].map((y) => `<rect x="410" y="${y}" width="230" height="16" rx="8" fill="rgba(0,0,0,.18)"/>`).join('')}`,
  pencil: `<g transform="rotate(-35 500 500)"><rect x="290" y="440" width="360" height="120" fill="#fff"/>
    <polygon points="650,440 780,500 650,560" fill="#fde68a"/><polygon points="740,480 780,500 740,520" fill="rgba(0,0,0,.55)"/>
    <rect x="240" y="440" width="60" height="120" rx="12" fill="rgba(0,0,0,.25)"/><rect x="300" y="440" width="20" height="120" fill="rgba(0,0,0,.18)"/></g>`,
  folder: `<path d="M240 340a40 40 0 0 1 40-40h160l60 70h240a40 40 0 0 1 40 40v280a40 40 0 0 1-40 40H280a40 40 0 0 1-40-40z" fill="#fff"/>
    <rect x="240" y="420" width="520" height="14" fill="rgba(0,0,0,.18)"/>`,
  palette: `<path d="M500 220c-150 0-270 110-270 250 0 130 100 250 240 250 60 0 70-40 50-70-25-40 0-80 60-80h60c60 0 100-40 100-100 0-130-110-250-240-250z" fill="#fff"/>
    <circle cx="370" cy="420" r="38" fill="#ef4444"/><circle cx="470" cy="340" r="38" fill="#f59e0b"/>
    <circle cx="590" cy="350" r="38" fill="#22c55e"/><circle cx="660" cy="450" r="38" fill="#3b82f6"/>`,
  ruler: `<g transform="rotate(-30 500 500)"><rect x="200" y="420" width="600" height="160" rx="18" fill="#fff"/>
    ${Array.from({ length: 21 }, (_, i) => `<rect x="${230 + i * 27}" y="420" width="6" height="${i % 5 === 0 ? 70 : 40}" fill="rgba(0,0,0,.4)"/>`).join('')}</g>`,
  box: `<polygon points="500,230 780,360 500,490 220,360" fill="#fff"/><polygon points="220,360 500,490 500,790 220,650" fill="rgba(255,255,255,.78)"/>
    <polygon points="780,360 500,490 500,790 780,650" fill="rgba(255,255,255,.55)"/><polygon points="500,230 560,258 280,388 220,360" fill="rgba(0,0,0,.12)"/>`,
};

const drawing = (icon: Icon, color: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".72"/></linearGradient></defs>
  <rect width="1000" height="1000" fill="url(#g)"/><circle cx="800" cy="200" r="260" fill="#fff" fill-opacity=".08"/>${ICONS[icon]}</svg>`);

async function writeImage(mediaDir: string, imageKey: string, product: DemoProduct) {
  const base = sharp(drawing(product.icon, product.color));
  for (const [name, width] of Object.entries(VARIANTS)) {
    const target = join(mediaDir, imageKey, `${name}.webp`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await base.clone().resize({ width }).webp({ quality: 82 }).toBuffer());
  }
}

const money = (value: number) => Math.round(value * 100) / 100;

export async function seedDemoCatalog(prisma: PrismaClient) {
  const mediaDir = resolve(process.env.MEDIA_DIR ?? './uploads');
  const retailMargin = Number(process.env.DEFAULT_RETAIL_MARGIN_PERCENT ?? 50);
  const wholesaleMargin = Number(process.env.DEFAULT_WHOLESALE_MARGIN_PERCENT ?? 25);

  const [categories, branches, actor] = await Promise.all([
    prisma.category.findMany(),
    prisma.branch.findMany({ where: { code: { in: [...BRANCH_ORDER] } } }),
    prisma.user.findFirstOrThrow({ where: { role: { name: 'SUPERADMIN' } } }),
  ]);
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const branchByCode = new Map(branches.map((b) => [b.code, b.id]));

  const productIds = new Map<string, string>();
  let created = 0;

  for (const [index, demo] of PRODUCTS.entries()) {
    const existing = await prisma.product.findUnique({ where: { sku: demo.sku }, select: { id: true } });
    if (existing) {
      productIds.set(demo.sku, existing.id);
      continue;
    }

    const imageKey = `products/${randomUUID()}`;
    await writeImage(mediaDir, imageKey, demo);

    const product = await prisma.product.create({
      data: {
        sku: demo.sku,
        barcode: `779000000${String(index + 1).padStart(4, '0')}`,
        name: demo.name,
        description: demo.description,
        categoryId: categoryBySlug.get(demo.category)!,
        imageKey,
        cost: money(demo.cost),
        retailPrice: money(demo.cost * (1 + retailMargin / 100)),
        wholesalePrice: money(demo.cost * (1 + wholesaleMargin / 100)),
      },
    });
    productIds.set(demo.sku, product.id);

    for (const [i, code] of BRANCH_ORDER.entries()) {
      const branchId = branchByCode.get(code);
      const stock = demo.stock[i];
      if (!branchId) continue;
      await prisma.branchInventory.create({ data: { branchId, productId: product.id, stock } });
      if (stock > 0) {
        await prisma.stockMovement.create({
          data: { branchId, productId: product.id, userId: actor.id, delta: stock, reason: 'INITIAL', note: 'Carga de demostración' },
        });
      }
    }
    created++;
  }

  await seedPromotions(prisma, categoryBySlug, productIds);
  console.log(`Catálogo de demostración: ${created} productos nuevos (${PRODUCTS.length} en total).`);
}

async function seedPromotions(prisma: PrismaClient, categoryBySlug: Map<string, string>, productIds: Map<string, string>) {
  const startsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (!(await prisma.promotion.findFirst({ where: { name: 'Vuelta a clases' } }))) {
    await prisma.promotion.create({
      data: {
        name: 'Vuelta a clases',
        description: '20% de descuento en útiles escolares',
        discountType: 'PERCENTAGE',
        value: 20,
        scope: 'CATEGORY',
        categoryId: categoryBySlug.get('utiles-escolares'),
        startsAt,
        endsAt,
      },
    });
  }

  if (!(await prisma.promotion.findFirst({ where: { name: 'Ofertas de la semana' } }))) {
    const featured = ['DEMO-008', 'DEMO-013', 'DEMO-014', 'DEMO-020', 'DEMO-022'].map((sku) => productIds.get(sku)!);
    await prisma.promotion.create({
      data: {
        name: 'Ofertas de la semana',
        discountType: 'PERCENTAGE',
        value: 15,
        scope: 'PRODUCTS',
        startsAt,
        endsAt,
        products: { create: featured.map((productId) => ({ productId })) },
      },
    });
  }
}
