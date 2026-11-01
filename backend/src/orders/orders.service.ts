import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { Page, skipTake } from '../common/pagination';
import { MediaUrlService } from '../media/media-url.service';
import { PaymentReconciliationService } from '../payments/payment-reconciliation.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderLifecycleService } from './lifecycle/order-lifecycle.service';
import { OrderView, orderInclude, toOrderView } from './order.view';
import type { ListOrdersQuery } from './orders.schemas';

/** Los pedidos del cliente: siempre filtrados por su dueño, así nadie puede ver o tocar los de otro. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  async list(customer: AuthenticatedCustomer, query: ListOrdersQuery): Promise<Page<OrderView>> {
    const where = { customerId: customer.id };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...skipTake(query) }),
    ]);
    return { items: orders.map((order) => this.view(order)), total, page: query.page, limit: query.limit };
  }

  async get(customer: AuthenticatedCustomer, orderId: string): Promise<OrderView> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId: customer.id }, include: orderInclude });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.view(order);
  }

  /**
   * Al volver del pago el aviso (webhook) puede no haber llegado todavía, o no llegar nunca (desarrollo
   * local). Se consulta a Mercado Pago directamente; el `paymentId` solo orienta la búsqueda.
   */
  async sync(customer: AuthenticatedCustomer, orderId: string, paymentId?: string): Promise<OrderView> {
    const current = await this.get(customer, orderId);
    const needsCheck = current.status === 'PENDING_PAYMENT' || (current.status === 'CANCELLED' && current.paymentStatus === null);
    if (needsCheck) await this.reconciliation.reconcileOrder(orderId, paymentId);
    return this.get(customer, orderId);
  }

  /** El cliente desiste de pagar: se libera la reserva de inmediato. */
  async cancel(customer: AuthenticatedCustomer, orderId: string): Promise<OrderView> {
    await this.get(customer, orderId);
    await this.lifecycle.cancel(orderId, 'customer');
    return this.get(customer, orderId);
  }

  private view(order: Parameters<typeof toOrderView>[0]): OrderView {
    return toOrderView(order, (imageKey) => this.mediaUrls.forKey(imageKey));
  }
}
