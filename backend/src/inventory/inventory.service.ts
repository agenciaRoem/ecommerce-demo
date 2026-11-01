import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementReason, Prisma } from '@prisma/client';
import type { BranchScope } from '../common/branch-scope';
import { Page, skipTake } from '../common/pagination';
import { MediaUrlService, ImageUrls } from '../media/media-url.service';
import { PrismaService } from '../prisma/prisma.service';
import { ADJUSTMENT_REASONS, type AdjustStockDto, type ListInventoryQuery } from './inventory.schemas';

export interface StockLevel {
  stock: number;
  reserved: number;
  available: number;
}

export interface InventoryRow extends StockLevel {
  branchId: string;
  product: { id: string; sku: string; barcode: string | null; name: string; image: ImageUrls | null };
  updatedAt: Date;
}

export interface StockChange {
  branchId: string;
  productId: string;
  userId: string;
  quantity: number;
  reason: MovementReason;
  note?: string;
}

export const toStockLevel = ({ stock, reserved }: { stock: number; reserved: number }): StockLevel => ({
  stock,
  reserved,
  available: stock - reserved,
});

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  /**
   * Suma stock de forma atómica (`increment` en la base, sin leer-modificar-escribir) y deja el movimiento
   * registrado. Debe ejecutarse dentro de la transacción del llamador para que ambos cambios sean un todo.
   */
  async applyIntake(tx: Prisma.TransactionClient, change: StockChange): Promise<void> {
    const { branchId, productId, userId, quantity, reason, note } = change;
    await tx.branchInventory.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId, stock: quantity },
      update: { stock: { increment: quantity }, version: { increment: 1 } },
    });
    await tx.stockMovement.create({ data: { branchId, productId, userId, delta: quantity, reason, note } });
  }

  /** Garantiza que el producto tenga fila de inventario en la sucursal (con stock 0). */
  async ensureRow(tx: Prisma.TransactionClient, branchId: string, productId: string): Promise<void> {
    await tx.branchInventory.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId },
      update: {},
    });
  }

  async receive(userId: string, branchId: string, productId: string, quantity: number, note?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await this.applyIntake(tx, { branchId, productId, userId, quantity, reason: 'INTAKE', note });
      const row = await tx.branchInventory.findUniqueOrThrow({
        where: { branchId_productId: { branchId, productId } },
      });
      return { branchId, productId, ...toStockLevel(row) };
    });
  }

  /**
   * Ajuste de emergencia en estantería (rotura, faltante, sobrante). Nunca deja el stock por debajo de lo que
   * ya está reservado para pedidos en curso: esas unidades están comprometidas con un cliente.
   */
  async adjust(userId: string, branchId: string, dto: AdjustStockDto) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, isActive: true }, select: { id: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const label = ADJUSTMENT_REASONS[dto.reason];
    const note = dto.note ? `${label}: ${dto.note}` : label;

    return this.prisma.$transaction(async (tx) => {
      if (dto.delta > 0) {
        await this.applyIntake(tx, { branchId, productId: dto.productId, userId, quantity: dto.delta, reason: 'ADJUSTMENT', note });
      } else {
        // La verificación y el descuento ocurren juntos en la base: dos ajustes simultáneos no pueden pasarse del límite.
        const changed = await tx.$executeRaw`
          UPDATE "branch_inventories"
             SET "stock" = "stock" + ${dto.delta}::int, "version" = "version" + 1, "updated_at" = now()
           WHERE "branch_id" = ${branchId}::uuid AND "product_id" = ${dto.productId}::uuid
             AND "stock" + ${dto.delta}::int >= "reserved" AND "stock" + ${dto.delta}::int >= 0`;
        if (changed === 0) throw new ConflictException(await this.describeLimit(tx, branchId, dto.productId));
        await tx.stockMovement.create({
          data: { branchId, productId: dto.productId, userId, delta: dto.delta, reason: 'ADJUSTMENT', note },
        });
      }
      const row = await tx.branchInventory.findUniqueOrThrow({
        where: { branchId_productId: { branchId, productId: dto.productId } },
      });
      return { branchId, productId: dto.productId, ...toStockLevel(row) };
    });
  }

  async list(scope: BranchScope, query: ListInventoryQuery): Promise<Page<InventoryRow>> {
    const where: Prisma.BranchInventoryWhereInput = {
      ...scope,
      ...(query.maxStock !== undefined && { stock: { lte: query.maxStock } }),
      product: {
        isActive: true,
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { startsWith: query.search, mode: 'insensitive' } },
            { barcode: { startsWith: query.search } },
          ],
        }),
      },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.branchInventory.count({ where }),
      this.prisma.branchInventory.findMany({
        where,
        include: { product: { select: { id: true, sku: true, barcode: true, name: true, imageKey: true } } },
        orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
        ...skipTake(query),
      }),
    ]);

    const items = rows.map(({ product: { imageKey, ...product }, ...row }) => ({
      branchId: row.branchId,
      product: { ...product, image: this.mediaUrls.forKey(imageKey) },
      ...toStockLevel(row),
      updatedAt: row.updatedAt,
    }));
    return { items, total, page: query.page, limit: query.limit };
  }

  private async describeLimit(tx: Prisma.TransactionClient, branchId: string, productId: string): Promise<string> {
    const row = await tx.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
      select: { stock: true, reserved: true },
    });
    if (!row) return 'Ese producto no tiene stock en esta sucursal.';
    const removable = Math.max(0, row.stock - row.reserved);
    return row.reserved > 0
      ? `Solo se pueden descontar ${removable} unidad(es): las otras ${row.reserved} están reservadas por pedidos en curso.`
      : `Solo se pueden descontar ${removable} unidad(es): es todo el stock que hay.`;
  }
}
