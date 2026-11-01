import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Page, skipTake } from '../../common/pagination';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BulkChange,
  PROBLEM_LABEL,
  PriceProblem,
  PriceSet,
  Rounding,
  applyChange,
  findProblem,
  marginPercent,
  samePrices,
} from './price-calculator';
import type { BulkPriceDto, ListPricesQuery, UpdatePriceDto } from './pricing-admin.schemas';

/** Un cambio masivo toca como mucho esta cantidad de productos: mantiene la transacción corta. */
export const MAX_BULK_PRODUCTS = 2000;
const PREVIEW_SAMPLE = 25;
const HISTORY_LIMIT = 50;

const productSelect = {
  id: true,
  sku: true,
  name: true,
  isActive: true,
  cost: true,
  retailPrice: true,
  wholesalePrice: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;
type PricedProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export interface PriceRow {
  id: string;
  sku: string;
  name: string;
  isActive: boolean;
  category: { id: string; name: string };
  cost: string;
  retailPrice: string;
  wholesalePrice: string;
  retailMarginPercent: string | null;
  wholesaleMarginPercent: string | null;
  updatedAt: string;
}

interface Planned {
  product: PricedProduct;
  next: PriceSet;
  problem: PriceProblem | null;
}

export interface BulkPreview {
  matched: number;
  changed: number;
  unchanged: number;
  invalid: number;
  /** Cuántos productos tienen cada problema. Si hay alguno, no se puede aplicar. */
  problems: Partial<Record<PriceProblem, number>>;
  canApply: boolean;
  sample: { id: string; sku: string; name: string; before: PriceSnapshot; after: PriceSnapshot; problem: string | null }[];
}

// `type` (no `interface`) para que sirva como valor JSON en la auditoría.
type PriceSnapshot = { cost: string; retailPrice: string; wholesalePrice: string };

const snapshot = (set: PriceSet): PriceSnapshot => ({
  cost: set.cost.toFixed(2),
  retailPrice: set.retailPrice.toFixed(2),
  wholesalePrice: set.wholesalePrice.toFixed(2),
});

const currentPrices = (product: PricedProduct): PriceSet => ({
  cost: product.cost,
  retailPrice: product.retailPrice,
  wholesalePrice: product.wholesalePrice,
});

function toRow(product: PricedProduct): PriceRow {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    isActive: product.isActive,
    category: product.category,
    ...snapshot(product),
    retailMarginPercent: marginPercent(product.retailPrice, product.cost),
    wholesaleMarginPercent: marginPercent(product.wholesalePrice, product.cost),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/**
 * Precios de venta y costos. Los precios son globales (no dependen de la sucursal): un cambio rige en todas.
 * Cada cambio queda en `product_price_changes` (inmutable) y los pedidos ya hechos no se ven afectados porque
 * congelan su precio. Las escrituras son optimistas: si alguien cambió el producto mientras tanto, se avisa.
 */
@Injectable()
export class PricingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListPricesQuery): Promise<Page<PriceRow>> {
    const where: Prisma.ProductWhereInput = {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { startsWith: query.search, mode: 'insensitive' } },
          { barcode: { startsWith: query.search } },
        ],
      }),
    };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, select: productSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }], ...skipTake(query) }),
    ]);
    return { items: products.map(toRow), total, page: query.page, limit: query.limit };
  }

  async update(user: AuthenticatedUser, productId: string, dto: UpdatePriceDto, ip?: string): Promise<PriceRow> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: productSelect });
    if (!product) throw new NotFoundException('El producto no existe');

    const decimal = (value: number | undefined, fallback: Prisma.Decimal) => (value === undefined ? fallback : new Prisma.Decimal(value).toDecimalPlaces(2));
    const next: PriceSet = {
      cost: decimal(dto.cost, product.cost),
      retailPrice: decimal(dto.retailPrice, product.retailPrice),
      wholesalePrice: decimal(dto.wholesalePrice, product.wholesalePrice),
    };
    const problem = findProblem(next);
    if (problem) throw new BadRequestException(PROBLEM_LABEL[problem]);
    if (samePrices(currentPrices(product), next)) throw new BadRequestException('No hay cambios para guardar');

    await this.prisma.$transaction(async (tx) => {
      await this.write(tx, user.id, product, next, dto.note);
      await this.audit.recordIn(tx, {
        actorId: user.id,
        action: 'product.price_updated',
        entity: 'product',
        entityId: product.id,
        metadata: { sku: product.sku, before: snapshot(currentPrices(product)), after: snapshot(next), ...(dto.note && { note: dto.note }) },
        ip,
      });
    });

    return toRow(await this.prisma.product.findUniqueOrThrow({ where: { id: productId }, select: productSelect }));
  }

  /** Simula un cambio masivo sin guardar nada: qué cambiaría, qué quedaría mal y una muestra. */
  async previewBulk(dto: BulkPriceDto): Promise<BulkPreview> {
    return this.summarize(await this.plan(dto));
  }

  async applyBulk(user: AuthenticatedUser, dto: BulkPriceDto, ip?: string): Promise<{ changed: number }> {
    const planned = await this.plan(dto);
    const preview = this.summarize(planned);
    if (!preview.canApply) throw new BadRequestException({ message: 'Hay productos que quedarían mal. Revisá la vista previa.', problems: preview.problems });

    const toWrite = planned.filter((entry) => !samePrices(currentPrices(entry.product), entry.next));
    if (toWrite.length === 0) throw new BadRequestException('Ningún producto cambiaría');

    await this.prisma.$transaction(
      async (tx) => {
        for (const entry of toWrite) await this.write(tx, user.id, entry.product, entry.next, dto.note);
        await this.audit.recordIn(tx, {
          actorId: user.id,
          action: 'product.prices_bulk_updated',
          entity: 'product',
          metadata: { target: dto.target, change: dto.change, rounding: dto.rounding, products: toWrite.length, ...(dto.note && { note: dto.note }) },
          ip,
        });
      },
      { timeout: 60_000 },
    );
    return { changed: toWrite.length };
  }

  async history(productId: string) {
    const exists = await this.prisma.product.count({ where: { id: productId } });
    if (!exists) throw new NotFoundException('El producto no existe');
    const changes = await this.prisma.productPriceChange.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      include: { user: { select: { fullName: true } } },
    });
    return changes.map((change) => ({
      id: change.id,
      at: change.createdAt.toISOString(),
      by: change.user?.fullName ?? null,
      note: change.note,
      cost: { from: change.oldCost.toFixed(2), to: change.newCost.toFixed(2) },
      retailPrice: { from: change.oldRetail.toFixed(2), to: change.newRetail.toFixed(2) },
      wholesalePrice: { from: change.oldWholesale.toFixed(2), to: change.newWholesale.toFixed(2) },
    }));
  }

  private async plan(dto: BulkPriceDto): Promise<Planned[]> {
    const where = await this.targetWhere(dto.target);
    const products = await this.prisma.product.findMany({ where, select: productSelect, orderBy: { id: 'asc' }, take: MAX_BULK_PRODUCTS + 1 });
    if (products.length > MAX_BULK_PRODUCTS) {
      throw new BadRequestException(`El cambio alcanza más de ${MAX_BULK_PRODUCTS} productos. Hacelo por categorías.`);
    }
    if (products.length === 0) throw new BadRequestException('No hay productos que coincidan');

    return products.map((product) => {
      const next = applyChange(currentPrices(product), dto.change as BulkChange, dto.rounding as Rounding);
      return { product, next, problem: findProblem(next) };
    });
  }

  private async targetWhere(target: BulkPriceDto['target']): Promise<Prisma.ProductWhereInput> {
    switch (target.scope) {
      case 'ALL':
        return { isActive: true };
      case 'CATEGORY': {
        const exists = await this.prisma.category.count({ where: { id: target.categoryId } });
        if (!exists) throw new BadRequestException('La categoría no existe');
        return { isActive: true, categoryId: target.categoryId };
      }
      case 'PRODUCTS':
        return { id: { in: target.productIds } };
    }
  }

  private summarize(planned: Planned[]): BulkPreview {
    const problems: Partial<Record<PriceProblem, number>> = {};
    let changed = 0;
    for (const entry of planned) {
      if (entry.problem) problems[entry.problem] = (problems[entry.problem] ?? 0) + 1;
      if (!samePrices(currentPrices(entry.product), entry.next)) changed += 1;
    }
    const invalid = planned.filter((entry) => entry.problem).length;

    // La muestra prioriza lo que está mal: es lo que hay que revisar antes de aplicar.
    const ordered = [...planned.filter((entry) => entry.problem), ...planned.filter((entry) => !entry.problem && !samePrices(currentPrices(entry.product), entry.next))];
    return {
      matched: planned.length,
      changed,
      unchanged: planned.length - changed,
      invalid,
      problems,
      canApply: invalid === 0 && changed > 0,
      sample: ordered.slice(0, PREVIEW_SAMPLE).map((entry) => ({
        id: entry.product.id,
        sku: entry.product.sku,
        name: entry.product.name,
        before: snapshot(currentPrices(entry.product)),
        after: snapshot(entry.next),
        problem: entry.problem ? PROBLEM_LABEL[entry.problem] : null,
      })),
    };
  }

  /** Guarda un cambio solo si el producto sigue como se lo vio (bloqueo optimista) y deja el historial. */
  private async write(tx: Prisma.TransactionClient, userId: string, product: PricedProduct, next: PriceSet, note?: string): Promise<void> {
    const { count } = await tx.product.updateMany({
      where: { id: product.id, cost: product.cost, retailPrice: product.retailPrice, wholesalePrice: product.wholesalePrice },
      data: { cost: next.cost, retailPrice: next.retailPrice, wholesalePrice: next.wholesalePrice },
    });
    if (count !== 1) throw new ConflictException(`"${product.name}" cambió mientras tanto. Volvé a cargar y reintentá.`);

    await tx.productPriceChange.create({
      data: {
        productId: product.id,
        userId,
        oldCost: product.cost,
        newCost: next.cost,
        oldRetail: product.retailPrice,
        newRetail: next.retailPrice,
        oldWholesale: product.wholesalePrice,
        newWholesale: next.wholesalePrice,
        note,
      },
    });
  }
}
