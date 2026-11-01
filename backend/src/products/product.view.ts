import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { StockLevel, toStockLevel } from '../inventory/inventory.service';
import type { ImageUrls } from '../media/media-url.service';

export const productInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }> & {
  inventories: { stock: number; reserved: number }[];
};

export interface ProductView {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: { id: string; name: string };
  image: ImageUrls | null;
  /** Solo para roles que gestionan inventario; SALA no ve costos. */
  cost?: string;
  retailPrice: string;
  wholesalePrice: string;
  /** Suma de las sucursales dentro del alcance del usuario. */
  stock: StockLevel;
}

const canSeeCost = (user: AuthenticatedUser) => user.role !== 'SALA';

export function toProductView(product: ProductRecord, user: AuthenticatedUser, image: ImageUrls | null): ProductView {
  const totals = product.inventories.reduce(
    (acc, row) => ({ stock: acc.stock + row.stock, reserved: acc.reserved + row.reserved }),
    { stock: 0, reserved: 0 },
  );

  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    category: product.category,
    image,
    ...(canSeeCost(user) && { cost: product.cost.toFixed(2) }),
    retailPrice: product.retailPrice.toFixed(2),
    wholesalePrice: product.wholesalePrice.toFixed(2),
    stock: toStockLevel(totals),
  };
}
