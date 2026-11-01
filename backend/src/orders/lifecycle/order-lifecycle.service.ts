import { Injectable, Logger } from '@nestjs/common';
import type { Order, OrderItem, OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { isUniqueViolation } from '../../common/prisma-errors';
import { StockLine, StockReservationService } from '../../inventory/stock-reservation.service';
import { PrismaService } from '../../prisma/prisma.service';

export type CancelReason = 'expired' | 'replaced' | 'payment_unavailable' | 'customer';

/** Lo que importa de un pago ya verificado contra la pasarela. */
export interface VerifiedPayment {
  id: string;
  status: string;
}

export type PaidOutcome =
  | 'paid' // pasó a pagado y el stock quedó vendido
  | 'paid_late' // el pedido estaba vencido, pero había stock y se recuperó
  | 'already_processed' // ya estaba pagado (aviso repetido)
  | 'payment_already_used' // ese pago ya cerró otro pedido: no se aplica dos veces
  | 'late_without_stock' // pago aprobado sobre un pedido vencido sin stock: requiere revisión humana
  | 'not_found';

type OrderWithItems = Order & { items: OrderItem[] };

const toLines = (items: readonly OrderItem[]): StockLine[] =>
  items.map(({ productId, quantity }) => ({ productId, quantity }));

/**
 * Transiciones de estado de un pedido y su efecto sobre el stock. Es la única pieza que mueve un pedido
 * entre PENDING_PAYMENT, PENDING y CANCELLED. Cada transición "reclama" el pedido con un UPDATE condicional
 * al estado esperado: si dos procesos coinciden (webhook y regreso del cliente, por ejemplo), solo uno
 * aplica los efectos de stock y el otro no hace nada.
 */
@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StockReservationService,
    private readonly audit: AuditService,
  ) {}

  /** Cancela un pedido que espera el pago y libera su reserva. `false` si ya no estaba esperando. */
  cancel(orderId: string, reason: CancelReason): Promise<boolean> {
    return this.prisma.$transaction((tx) => this.cancelInTransaction(tx, orderId, reason));
  }

  /** Igual que `cancel`, dentro de una transacción ya abierta (p. ej. al reemplazar un pedido por otro nuevo). */
  async cancelInTransaction(tx: Prisma.TransactionClient, orderId: string, reason: CancelReason): Promise<boolean> {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, expiresAt: null, checkoutUrl: null },
    });
    if (claimed.count === 0) return false;

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    await this.reservations.release(tx, order.branchId, toLines(order.items));
    await this.recordEvent(tx, orderId, 'PENDING_PAYMENT', 'CANCELLED', reason);
    return true;
  }

  /** Marca el pedido como pagado y convierte la reserva en venta. Seguro de repetir. */
  async markPaid(orderId: string, payment: VerifiedPayment): Promise<PaidOutcome> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
        if (!order) return 'not_found' as const;
        if (order.status === 'PENDING_PAYMENT') return this.payReserved(tx, order, payment);
        if (order.status === 'CANCELLED' && !order.paymentId) return this.payAfterCancellation(tx, order, payment);
        return 'already_processed' as const;
      });
    } catch (error) {
      if (error instanceof LateWithoutStock) {
        await this.flagLatePayment(orderId, payment);
        return 'late_without_stock';
      }
      // Un pago es de un único pedido (restricción en la base). Reaparecer en otro es una anomalía a revisar,
      // no un error técnico: se responde bien para que la pasarela no reintente el aviso indefinidamente.
      if (isUniqueViolation(error, 'payment_id')) {
        await this.flagPaymentIssue(orderId, `El pago ${payment.id} ya está asociado a otro pedido y no se aplicó a este.`);
        return 'payment_already_used';
      }
      throw error;
    }
  }

  /** Anota el estado de un pago que todavía no se aprobó (pendiente, en proceso, rechazado). */
  async recordPaymentStatus(orderId: string, status: string): Promise<void> {
    await this.prisma.order.updateMany({ where: { id: orderId, status: 'PENDING_PAYMENT' }, data: { paymentStatus: status } });
  }

  /** Deja constancia de algo que requiere revisión humana (p. ej. un importe que no coincide). */
  async flagPaymentIssue(orderId: string, issue: string): Promise<void> {
    await this.prisma.order.updateMany({ where: { id: orderId }, data: { paymentIssue: issue } });
    await this.audit.record({ actorId: null, action: 'order.payment_issue', entity: 'order', entityId: orderId, metadata: { issue } });
  }

  /** Cancela los pedidos cuyo plazo de pago venció y libera sus reservas. Devuelve cuántos liberó. */
  async expireDue(limit = 50): Promise<number> {
    const due = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    let released = 0;
    for (const { id } of due) {
      try {
        if (await this.cancel(id, 'expired')) released++;
      } catch (error) {
        // Un pedido con problemas no debe frenar a los demás; se reintenta en la próxima vuelta.
        this.logger.error(`No se pudo vencer el pedido ${id}: ${(error as Error).message}`);
      }
    }
    return released;
  }

  private async payReserved(tx: Prisma.TransactionClient, order: OrderWithItems, payment: VerifiedPayment): Promise<PaidOutcome> {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: this.paidFields(payment),
    });
    if (claimed.count === 0) return 'already_processed';

    await this.reservations.commit(tx, order.branchId, toLines(order.items));
    await this.recordSale(tx, order);
    await this.recordEvent(tx, order.id, 'PENDING_PAYMENT', 'PENDING', `Pago ${payment.id}`);
    return 'paid';
  }

  private async payAfterCancellation(tx: Prisma.TransactionClient, order: OrderWithItems, payment: VerifiedPayment): Promise<PaidOutcome> {
    const shortages = await this.reservations.takeUnreserved(tx, order.branchId, toLines(order.items));
    // Sin stock suficiente se aborta la transacción: no queda tomada ninguna unidad a medias.
    if (shortages.length > 0) throw new LateWithoutStock();

    await tx.order.update({
      where: { id: order.id },
      data: { ...this.paidFields(payment), cancelledAt: null, cancelReason: null, paymentIssue: 'Se pagó después de vencer el plazo; había stock y se recuperó.' },
    });
    await this.recordSale(tx, order);
    await this.recordEvent(tx, order.id, 'CANCELLED', 'PENDING', `Pago ${payment.id} (después de vencer el plazo)`);
    return 'paid_late';
  }

  /** El cliente pagó pero ya no hay con qué cumplir: el pedido sigue cancelado y queda marcado para reembolsar. */
  private async flagLatePayment(orderId: string, payment: VerifiedPayment): Promise<void> {
    const issue = 'Pago aprobado después de vencer el plazo y sin stock disponible: hay que reembolsarlo.';
    this.logger.warn(`Pago ${payment.id} aprobado sobre el pedido ${orderId} vencido y sin stock: requiere reembolso`);
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentProvider: 'MERCADOPAGO', paymentId: payment.id, paymentStatus: payment.status, paymentIssue: issue },
    });
    await this.audit.record({
      actorId: null,
      action: 'order.late_payment_without_stock',
      entity: 'order',
      entityId: orderId,
      metadata: { paymentId: payment.id },
    });
  }

  private paidFields(payment: VerifiedPayment): Prisma.OrderUncheckedUpdateManyInput {
    return {
      status: 'PENDING',
      paymentProvider: 'MERCADOPAGO',
      paymentId: payment.id,
      paymentStatus: payment.status,
      paidAt: new Date(),
      expiresAt: null,
      checkoutUrl: null,
    };
  }

  private recordEvent(tx: Prisma.TransactionClient, orderId: string, from: OrderStatus, to: OrderStatus, note: string) {
    return tx.orderStatusEvent.create({ data: { orderId, fromStatus: from, toStatus: to, note } });
  }

  private async recordSale(tx: Prisma.TransactionClient, order: OrderWithItems): Promise<void> {
    await tx.stockMovement.createMany({
      data: order.items.map((item) => ({
        branchId: order.branchId,
        productId: item.productId,
        orderId: order.id,
        delta: -item.quantity,
        reason: 'SALE' as const,
        note: `Pedido #${order.number}`,
      })),
    });
  }
}

/** Señal interna para deshacer la transacción de un pago tardío sin stock. */
class LateWithoutStock extends Error {
  constructor() {
    super('Pago tardío sin stock');
  }
}
