import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { BranchScope, requireBranchId } from '../common/branch-scope';
import { Page, skipTake } from '../common/pagination';
import { isUniqueViolation } from '../common/prisma-errors';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { InventoryService } from '../inventory/inventory.service';
import { MediaUrlService } from '../media/media-url.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from './pricing.service';
import { ProductRecord, ProductView, productInclude, toProductView } from './product.view';
import type { CreateProductDto, ListProductsQuery, UpdateProductDto } from './products.schemas';

const generateSku = () => `OMN-${randomBytes(4).toString('hex').toUpperCase()}`;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly pricing: PricingService,
    private readonly mediaUrls: MediaUrlService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, scope: BranchScope, query: ListProductsQuery): Promise<Page<ProductView>> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { startsWith: query.search, mode: 'insensitive' } },
          { barcode: { startsWith: query.search } },
        ],
      }),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.includeFor(scope),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...skipTake(query),
      }),
    ]);
    return {
      items: records.map((record) => this.toView(record, user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Búsqueda exacta por código de barras o SKU (escaneo en el depósito). */
  async lookup(user: AuthenticatedUser, scope: BranchScope, code: string): Promise<ProductView> {
    const record = await this.prisma.product.findFirst({
      where: { isActive: true, OR: [{ barcode: code }, { sku: code.toUpperCase() }] },
      include: this.includeFor(scope),
    });
    if (!record) throw new NotFoundException('No existe un producto con ese código');
    return this.toView(record, user);
  }

  /** Alta de producto con su stock inicial en la sucursal, todo en una única transacción. */
  async create(user: AuthenticatedUser, scope: BranchScope, dto: CreateProductDto): Promise<ProductView> {
    const branchId = requireBranchId(scope);
    const cost = new Prisma.Decimal(dto.cost).toDecimalPlaces(2);

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId }, select: { id: true } });
    if (!category) throw new BadRequestException('La categoría no existe');

    try {
      const productId = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: dto.sku ?? generateSku(),
            barcode: dto.barcode,
            name: dto.name,
            description: dto.description,
            categoryId: dto.categoryId,
            imageKey: dto.imageKey,
            cost,
            ...this.pricing.initialPrices(cost),
          },
          select: { id: true },
        });

        // El encargado de stock da de alta el producto, no su stock: eso lo cargan los empleados de depósito.
        const quantity = user.role === 'ENCARGADO_STOCK' ? 0 : dto.quantity;
        if (quantity > 0) {
          await this.inventory.applyIntake(tx, {
            branchId,
            productId: product.id,
            userId: user.id,
            quantity,
            reason: 'INITIAL',
          });
        } else {
          await this.inventory.ensureRow(tx, branchId, product.id);
        }
        return product.id;
      });

      const record = await this.prisma.product.findUniqueOrThrow({
        where: { id: productId },
        include: this.includeFor(scope),
      });
      return this.toView(record, user);
    } catch (error) {
      if (isUniqueViolation(error, 'barcode')) throw new ConflictException('Ya existe un producto con ese código de barras');
      if (isUniqueViolation(error, 'sku')) throw new ConflictException('Ya existe un producto con ese SKU');
      throw error;
    }
  }

  /** Corrige datos del producto (nombre, código, categoría, descripción, foto). Precios y stock no se tocan acá. */
  async update(user: AuthenticatedUser, scope: BranchScope, id: string, dto: UpdateProductDto): Promise<ProductView> {
    const current = await this.prisma.product.findUnique({ where: { id }, select: { sku: true } });
    if (!current) throw new NotFoundException('El producto no existe');
    if (dto.categoryId && !(await this.prisma.category.count({ where: { id: dto.categoryId } }))) {
      throw new BadRequestException('La categoría no existe');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: dto });
        await this.audit.recordIn(tx, {
          actorId: user.id,
          action: 'product.updated',
          entity: 'product',
          entityId: id,
          metadata: { sku: current.sku, changes: Object.keys(dto) },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, 'barcode')) throw new ConflictException('Ya existe un producto con ese código de barras');
      throw error;
    }

    const record = await this.prisma.product.findUniqueOrThrow({ where: { id }, include: this.includeFor(scope) });
    return this.toView(record, user);
  }

  private includeFor(scope: BranchScope) {
    return { ...productInclude, inventories: { where: scope, select: { stock: true, reserved: true } } };
  }

  private toView(record: ProductRecord, user: AuthenticatedUser): ProductView {
    return toProductView(record, user, this.mediaUrls.forKey(record.imageKey));
  }
}
