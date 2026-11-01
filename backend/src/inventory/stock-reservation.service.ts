import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export interface StockLine {
  productId: string;
  quantity: number;
}

export interface Shortage extends StockLine {
  /** Unidades que realmente había disponibles (stock menos reservas). */
  available: number;
}

/** Siempre en el mismo orden (por producto): dos pedidos que se cruzan toman los bloqueos en el mismo orden y no se traban. */
const inLockOrder = (lines: readonly StockLine[]) => [...lines].sort((a, b) => a.productId.localeCompare(b.productId));

/**
 * Movimientos de stock de un pedido, en tres pasos:
 *   reservar  → al iniciar el pago: las unidades dejan de estar disponibles pero siguen en el estante;
 *   confirmar → al aprobarse el pago: salen del stock físico;
 *   liberar   → si el pago no llega: vuelven a estar disponibles.
 *
 * Cada paso es un único UPDATE condicional: la verificación y el cambio ocurren juntos en la base, así que
 * dos compradores de la última unidad nunca pueden ganar los dos. Todos reciben la transacción del llamador:
 * o se aplica el pedido completo o no se aplica nada.
 */
@Injectable()
export class StockReservationService {
  /** Reserva las unidades. Devuelve los faltantes: si no está vacío, el llamador debe deshacer la transacción. */
  async reserve(tx: Prisma.TransactionClient, branchId: string, lines: readonly StockLine[]): Promise<Shortage[]> {
    const shortages: Shortage[] = [];
    for (const line of inLockOrder(lines)) {
      const changed = await tx.$executeRaw`
        UPDATE "branch_inventories"
           SET "reserved" = "reserved" + ${line.quantity}::int, "version" = "version" + 1, "updated_at" = now()
         WHERE "branch_id" = ${branchId}::uuid AND "product_id" = ${line.productId}::uuid
           AND "stock" - "reserved" >= ${line.quantity}::int`;
      if (changed === 0) shortages.push({ ...line, available: await this.available(tx, branchId, line.productId) });
    }
    return shortages;
  }

  /** Devuelve a disponible lo reservado. */
  async release(tx: Prisma.TransactionClient, branchId: string, lines: readonly StockLine[]): Promise<void> {
    for (const line of inLockOrder(lines)) {
      const changed = await tx.$executeRaw`
        UPDATE "branch_inventories"
           SET "reserved" = "reserved" - ${line.quantity}::int, "version" = "version" + 1, "updated_at" = now()
         WHERE "branch_id" = ${branchId}::uuid AND "product_id" = ${line.productId}::uuid
           AND "reserved" >= ${line.quantity}::int`;
      this.assertApplied(changed, 'liberar', line);
    }
  }

  /** Pasa lo reservado a vendido: baja el stock físico y la reserva a la vez. */
  async commit(tx: Prisma.TransactionClient, branchId: string, lines: readonly StockLine[]): Promise<void> {
    for (const line of inLockOrder(lines)) {
      const changed = await tx.$executeRaw`
        UPDATE "branch_inventories"
           SET "stock" = "stock" - ${line.quantity}::int, "reserved" = "reserved" - ${line.quantity}::int,
               "version" = "version" + 1, "updated_at" = now()
         WHERE "branch_id" = ${branchId}::uuid AND "product_id" = ${line.productId}::uuid
           AND "reserved" >= ${line.quantity}::int AND "stock" >= ${line.quantity}::int`;
      this.assertApplied(changed, 'confirmar', line);
    }
  }

  /**
   * Vende unidades que no estaban reservadas (un pago aprobado después de vencer la reserva).
   * Devuelve los faltantes: si no está vacío, el llamador debe deshacer la transacción.
   */
  async takeUnreserved(tx: Prisma.TransactionClient, branchId: string, lines: readonly StockLine[]): Promise<Shortage[]> {
    const shortages: Shortage[] = [];
    for (const line of inLockOrder(lines)) {
      const changed = await tx.$executeRaw`
        UPDATE "branch_inventories"
           SET "stock" = "stock" - ${line.quantity}::int, "version" = "version" + 1, "updated_at" = now()
         WHERE "branch_id" = ${branchId}::uuid AND "product_id" = ${line.productId}::uuid
           AND "stock" - "reserved" >= ${line.quantity}::int`;
      if (changed === 0) shortages.push({ ...line, available: await this.available(tx, branchId, line.productId) });
    }
    return shortages;
  }

  private async available(tx: Prisma.TransactionClient, branchId: string, productId: string): Promise<number> {
    const row = await tx.branchInventory.findUnique({
      where: { branchId_productId: { branchId, productId } },
      select: { stock: true, reserved: true },
    });
    return row ? Math.max(0, row.stock - row.reserved) : 0;
  }

  /** Una reserva que no se puede aplicar indica datos inconsistentes: se aborta todo en lugar de seguir a ciegas. */
  private assertApplied(changed: number, action: string, line: StockLine): void {
    if (changed === 0) {
      throw new Error(`Inconsistencia de stock: no se pudo ${action} ${line.quantity} unidad(es) del producto ${line.productId}`);
    }
  }
}
