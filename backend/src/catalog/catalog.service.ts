import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Page, skipTake } from '../common/pagination';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { ImageUrls, MediaUrlService } from '../media/media-url.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityLevel, availabilityLevel, availableUnits, sumAvailable } from './availability';
import type { CatalogListQuery } from './catalog.schemas';
import { PriceView, promotionProductWhere, resolvePrice } from './promotion-pricing';
import { PromotionsService } from './promotions.service';

export interface CatalogProduct {
  id: string;
  name: string;
  category: { id: string; name: string; slug: string };
  image: ImageUrls | null;
  price: PriceView;
  availability: AvailabilityLevel;
}

export interface BranchAvailability {
  id: string;
  name: string;
  address: string;
  available: number;
  level: AvailabilityLevel;
}

export interface CatalogProductDetail extends CatalogProduct {
  description: string | null;
  branches: BranchAvailability[];
}

const productInclude = { category: { select: { id: true, name: true, slug: true } } } as const;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  async list(customer: AuthenticatedCustomer | undefined, query: CatalogListQuery): Promise<Page<CatalogProduct>> {
    const promotions = await this.promotions.activeFor(customer?.type ?? 'RETAIL', query.branchId);
    const stockScope = this.stockScope(query.branchId);

    const conditions: Prisma.ProductWhereInput[] = [{ isActive: true }];
    if (query.category) conditions.push({ category: { slug: query.category } });
    if (query.search) {
      conditions.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { startsWith: query.search, mode: 'insensitive' } },
          { barcode: { startsWith: query.search } },
        ],
      });
    }
    // Aproximación: "con stock" mira el stock físico; el disponible exacto (menos reservas) se informa en cada ítem.
    if (query.inStock) conditions.push({ inventories: { some: { ...stockScope, stock: { gt: 0 } } } });
    if (query.onSale) conditions.push(promotionProductWhere(promotions));
    const where: Prisma.ProductWhereInput = { AND: conditions };

    const priceColumn = customer?.verified ? 'wholesalePrice' : 'retailPrice';
    const orderBy = this.orderBy(query.sort, priceColumn);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        ...skipTake(query),
        include: { ...productInclude, inventories: { where: stockScope, select: { stock: true, reserved: true } } },
      }),
    ]);

    const items = records.map((record) => ({
      id: record.id,
      name: record.name,
      category: record.category,
      image: this.mediaUrls.forKey(record.imageKey),
      price: resolvePrice(record[priceColumn], record, promotions),
      availability: availabilityLevel(sumAvailable(record.inventories)),
    }));
    return { items, total, page: query.page, limit: query.limit };
  }

  async detail(
    customer: AuthenticatedCustomer | undefined,
    productId: string,
    branchId?: string,
  ): Promise<CatalogProductDetail> {
    const record = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      include: productInclude,
    });
    if (!record) throw new NotFoundException('Producto no encontrado');

    const [promotions, branches] = await Promise.all([
      this.promotions.activeFor(customer?.type ?? 'RETAIL', branchId),
      this.branchAvailability(productId),
    ]);
    const priceColumn = customer?.verified ? 'wholesalePrice' : 'retailPrice';

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      category: record.category,
      image: this.mediaUrls.forKey(record.imageKey),
      price: resolvePrice(record[priceColumn], record, promotions),
      availability: availabilityLevel(branches.reduce((total, branch) => total + branch.available, 0)),
      branches,
    };
  }

  /** Stock por sucursal activa, siempre leído en el momento (sin caché). */
  async branchAvailability(productId: string): Promise<BranchAvailability[]> {
    const [branches, inventories] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, address: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.branchInventory.findMany({
        where: { productId },
        select: { branchId: true, stock: true, reserved: true },
      }),
    ]);

    const byBranch = new Map(inventories.map((row) => [row.branchId, availableUnits(row)]));
    return branches.map((branch) => {
      const available = byBranch.get(branch.id) ?? 0;
      return { ...branch, available, level: availabilityLevel(available) };
    });
  }

  listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, address: true, phone: true },
      orderBy: { name: 'asc' },
    });
  }

  async listCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: { where: { isActive: true } } } },
        // Imagen representativa: la del producto más reciente que tenga foto.
        products: {
          where: { isActive: true, imageKey: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { imageKey: true },
        },
      },
    });
    return categories.map(({ products, _count, ...category }) => ({
      ...category,
      productCount: _count.products,
      image: this.mediaUrls.forKey(products[0]?.imageKey ?? null),
    }));
  }

  /** Inventario que cuenta para la consulta: el de una sucursal, o el de todas las activas. */
  private stockScope(branchId?: string): Prisma.BranchInventoryWhereInput {
    return branchId ? { branchId } : { branch: { isActive: true } };
  }

  /** El orden por precio usa el precio de lista de la columna que ve el cliente (no el rebajado). */
  private orderBy(
    sort: CatalogListQuery['sort'],
    priceColumn: 'retailPrice' | 'wholesalePrice',
  ): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ [priceColumn]: 'asc' }, { id: 'asc' }];
      case 'price_desc':
        return [{ [priceColumn]: 'desc' }, { id: 'asc' }];
      case 'name':
        return [{ name: 'asc' }, { id: 'asc' }];
      case 'newest':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
    }
  }
}
