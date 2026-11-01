import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderStatus, Prisma } from '@prisma/client';
import type { BranchScope } from '../../common/branch-scope';
import { Page, skipTake } from '../../common/pagination';
import { MediaUrlService } from '../../media/media-url.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListBranchOrdersQuery } from './fulfillment.schemas';
import { ACTIVE_STATUSES, ActiveStatus, canTransition } from './order-transitions';
import { StaffOrderView, staffOrderInclude, toStaffOrderView } from './staff-order.view';

export type QueueSummary = Record<ActiveStatus, number>;

/**
 * Trabajo de la sucursal sobre los pedidos ya pagados: preparar, dejar listo y entregar. Todo se consulta y
 * se modifica a través de `scope` (la sucursal del empleado), así un empleado nunca ve ni toca pedidos de otra.
 */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  /** Cuántos pedidos hay en cada etapa de la cola. */
  async summary(scope: BranchScope): Promise<QueueSummary> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { ...scope, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(ACTIVE_STATUSES.map((status) => [status, 0])) as QueueSummary;
    for (const group of groups) counts[group.status as ActiveStatus] = group._count._all;
    return counts;
  }

  async list(scope: BranchScope, query: ListBranchOrdersQuery): Promise<Page<StaffOrderView>> {
    const active = query.view === 'active';
    const where: Prisma.OrderWhereInput = {
      ...scope,
      status: active ? { in: [...ACTIVE_STATUSES] } : 'COMPLETED',
      ...(query.search && this.searchFilter(query.search)),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: staffOrderInclude,
        // La cola se atiende en orden de llegada; lo entregado, lo más reciente primero.
        orderBy: active ? [{ paidAt: 'asc' }, { number: 'asc' }] : [{ updatedAt: 'desc' }],
        ...skipTake(query),
      }),
    ]);
    return { items: orders.map((order) => this.view(order)), total, page: query.page, limit: query.limit };
  }

  async get(scope: BranchScope, orderId: string): Promise<StaffOrderView> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...scope, status: { in: [...ACTIVE_STATUSES, 'COMPLETED'] } },
      include: staffOrderInclude,
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.view(order);
  }

  /** Mueve un pedido al estado indicado, si el paso es válido, y deja constancia de quién lo hizo. */
  async transition(scope: BranchScope, userId: string, orderId: string, to: OrderStatus): Promise<StaffOrderView> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...scope },
      select: { id: true, status: true, deliveryMethod: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (!canTransition(order.status, to, order.deliveryMethod)) {
      throw new ConflictException('Ese cambio de estado no está permitido para este pedido.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Se reclama el pedido solo si sigue en el estado que se vio: si otro empleado lo movió antes, no se pisa.
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: to } });
      if (claimed.count === 0) throw new ConflictException('Otro empleado ya cambió este pedido. Actualizá la pantalla.');
      await tx.orderStatusEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: to, userId } });
    });
    return this.get(scope, orderId);
  }

  /** Por número de pedido si son dígitos; si no, por nombre del cliente o del comercio. */
  private searchFilter(search: string): Prisma.OrderWhereInput {
    if (/^\d{1,9}$/.test(search)) return { number: Number(search) };
    return {
      customer: {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { businessName: { contains: search, mode: 'insensitive' } },
        ],
      },
    };
  }

  private view(order: Parameters<typeof toStaffOrderView>[0]): StaffOrderView {
    return toStaffOrderView(order, (key) => this.mediaUrls.forKey(key));
  }
}
