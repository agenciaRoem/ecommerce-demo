import { Injectable } from '@nestjs/common';
import type { CustomerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivePromotion } from './promotion-pricing';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Promociones vigentes ahora para ese tipo de cliente, globales o de la sucursal indicada. */
  async activeFor(audience: CustomerType, branchId?: string): Promise<ActivePromotion[]> {
    const now = new Date();
    const rows = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        audience: { in: ['ALL', audience] },
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
      include: { products: { select: { productId: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      discountType: row.discountType,
      value: row.value,
      scope: row.scope,
      categoryId: row.categoryId,
      productIds: new Set(row.products.map((p) => p.productId)),
    }));
  }
}
