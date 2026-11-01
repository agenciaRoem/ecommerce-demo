import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { BranchScope } from '../../common/branch-scope';
import { Page, skipTake } from '../../common/pagination';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListPromotionsQuery, PromotionDto } from './promotions-admin.schemas';

const promotionInclude = {
  category: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  products: { select: { product: { select: { id: true, sku: true, name: true } } } },
} satisfies Prisma.PromotionInclude;
type PromotionRecord = Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>;

export type PromotionState = 'active' | 'upcoming' | 'ended' | 'inactive';

export interface PromotionView {
  id: string;
  name: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  audience: 'ALL' | 'RETAIL' | 'COMMERCE';
  scope: 'ALL' | 'CATEGORY' | 'PRODUCTS';
  category: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  products: { id: string; sku: string; name: string }[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: PromotionState;
}

function stateOf(promotion: { isActive: boolean; startsAt: Date; endsAt: Date }, now: Date): PromotionState {
  if (!promotion.isActive) return 'inactive';
  if (promotion.endsAt < now) return 'ended';
  if (promotion.startsAt > now) return 'upcoming';
  return 'active';
}

function toView(promotion: PromotionRecord, now: Date): PromotionView {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    discountType: promotion.discountType,
    value: promotion.value.toFixed(2),
    audience: promotion.audience,
    scope: promotion.scope,
    category: promotion.category,
    branch: promotion.branch,
    products: promotion.products.map((row) => row.product),
    startsAt: promotion.startsAt.toISOString(),
    endsAt: promotion.endsAt.toISOString(),
    isActive: promotion.isActive,
    state: stateOf(promotion, now),
  };
}

/**
 * Descuentos por evento. Un gerente maneja los de su sucursal y ve los globales (de todas las sucursales), que
 * solo toca el superadmin. Los pedidos ya hechos guardan el descuento que tuvieron, así que editar no los afecta.
 */
@Injectable()
export class PromotionsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(scope: BranchScope, query: ListPromotionsQuery): Promise<Page<PromotionView>> {
    const now = new Date();
    const where: Prisma.PromotionWhereInput = {
      AND: [
        scope.branchId ? { OR: [{ branchId: null }, { branchId: scope.branchId }] } : {},
        this.stateFilter(query.status, now),
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.promotion.count({ where }),
      this.prisma.promotion.findMany({ where, include: promotionInclude, orderBy: [{ startsAt: 'desc' }, { id: 'asc' }], ...skipTake(query) }),
    ]);
    return { items: rows.map((row) => toView(row, now)), total, page: query.page, limit: query.limit };
  }

  async create(user: AuthenticatedUser, dto: PromotionDto, ip?: string): Promise<PromotionView> {
    const branchId = this.branchFor(user, dto.branchId);
    await this.assertReferences(dto);

    const id = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({ data: { ...this.columns(dto), branchId }, select: { id: true } });
      await this.setProducts(tx, created.id, dto);
      await this.audit.recordIn(tx, { actorId: user.id, action: 'promotion.created', entity: 'promotion', entityId: created.id, metadata: this.summary(dto, branchId), ip });
      return created.id;
    });
    return this.get(id);
  }

  async update(user: AuthenticatedUser, id: string, dto: PromotionDto, ip?: string): Promise<PromotionView> {
    const current = await this.prisma.promotion.findUnique({ where: { id }, select: { branchId: true } });
    if (!current) throw new NotFoundException('La promoción no existe');
    this.assertCanManage(user, current.branchId);

    const branchId = this.branchFor(user, dto.branchId === undefined ? current.branchId : dto.branchId);
    await this.assertReferences(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({ where: { id }, data: { ...this.columns(dto), branchId } });
      await this.setProducts(tx, id, dto);
      await this.audit.recordIn(tx, { actorId: user.id, action: 'promotion.updated', entity: 'promotion', entityId: id, metadata: this.summary(dto, branchId), ip });
    });
    return this.get(id);
  }

  private async get(id: string): Promise<PromotionView> {
    return toView(await this.prisma.promotion.findUniqueOrThrow({ where: { id }, include: promotionInclude }), new Date());
  }

  private stateFilter(status: ListPromotionsQuery['status'], now: Date): Prisma.PromotionWhereInput {
    switch (status) {
      case 'active':
        return { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } };
      case 'upcoming':
        return { isActive: true, startsAt: { gt: now } };
      case 'ended':
        return { isActive: true, endsAt: { lt: now } };
      case 'inactive':
        return { isActive: false };
      case 'all':
        return {};
    }
  }

  /** El gerente solo trabaja con su sucursal; la promoción global (sin sucursal) es del superadmin. */
  private branchFor(user: AuthenticatedUser, requested: string | null | undefined): string | null {
    if (user.role === 'SUPERADMIN') return requested ?? null;
    if (requested && requested !== user.branchId) throw new ForbiddenException('No tenés acceso a esa sucursal');
    if (!user.branchId) throw new ForbiddenException('El usuario no tiene una sucursal asignada');
    if (requested === null) throw new ForbiddenException('Las promociones de todas las sucursales las crea el superadmin');
    return user.branchId;
  }

  private assertCanManage(user: AuthenticatedUser, promotionBranchId: string | null): void {
    if (user.role === 'SUPERADMIN') return;
    if (promotionBranchId !== user.branchId) throw new NotFoundException('La promoción no existe'); // ni confirma que existe
  }

  private columns(dto: PromotionDto) {
    return {
      name: dto.name,
      description: dto.description ?? null,
      discountType: dto.discountType,
      value: new Prisma.Decimal(dto.value).toDecimalPlaces(2),
      audience: dto.audience,
      scope: dto.scope,
      categoryId: dto.scope === 'CATEGORY' ? dto.categoryId : null,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      isActive: dto.isActive,
    };
  }

  private async setProducts(tx: Prisma.TransactionClient, promotionId: string, dto: PromotionDto): Promise<void> {
    await tx.promotionProduct.deleteMany({ where: { promotionId } });
    if (dto.scope === 'PRODUCTS' && dto.productIds?.length) {
      await tx.promotionProduct.createMany({ data: [...new Set(dto.productIds)].map((productId) => ({ promotionId, productId })) });
    }
  }

  private async assertReferences(dto: PromotionDto): Promise<void> {
    if (dto.categoryId && !(await this.prisma.category.count({ where: { id: dto.categoryId } }))) {
      throw new BadRequestException('La categoría no existe');
    }
    if (dto.branchId && !(await this.prisma.branch.count({ where: { id: dto.branchId } }))) {
      throw new BadRequestException('La sucursal no existe');
    }
    if (dto.productIds?.length) {
      const unique = [...new Set(dto.productIds)];
      if ((await this.prisma.product.count({ where: { id: { in: unique } } })) !== unique.length) {
        throw new BadRequestException('Algún producto no existe');
      }
    }
  }

  private summary(dto: PromotionDto, branchId: string | null): Prisma.InputJsonValue {
    return {
      name: dto.name,
      discountType: dto.discountType,
      value: dto.value,
      audience: dto.audience,
      scope: dto.scope,
      branchId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      isActive: dto.isActive,
    };
  }
}
