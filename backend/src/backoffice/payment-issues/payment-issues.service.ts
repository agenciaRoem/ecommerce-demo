import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ResolveIssueDto } from './payment-issues.schemas';

/** Se muestran como mucho estos: si se acumulan más, hay un problema que atender antes que un paginador. */
const LIST_LIMIT = 100;

/**
 * Pagos que requieren una decisión humana: un importe que no coincide, un pago repetido o uno que llegó tarde y
 * sin stock. El sistema nunca reembolsa solo; la persona lo resuelve en Mercado Pago y lo deja asentado acá.
 */
@Injectable()
export class PaymentIssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const orders = await this.prisma.order.findMany({
      where: { paymentIssue: { not: null } },
      orderBy: { updatedAt: 'asc' }, // el que espera hace más, primero
      take: LIST_LIMIT,
      include: {
        customer: { select: { fullName: true, businessName: true, email: true, phone: true } },
        branch: { select: { name: true } },
      },
    });
    return orders.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      total: order.total.toFixed(2),
      issue: order.paymentIssue,
      paymentId: order.paymentId,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      branch: order.branch.name,
      customer: {
        name: order.customer.businessName ?? order.customer.fullName,
        email: order.customer.email,
        phone: order.customer.phone,
      },
    }));
  }

  async resolve(actorId: string, orderId: string, dto: ResolveIssueDto, ip?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { number: true, paymentIssue: true, paymentId: true } });
    if (!order) throw new NotFoundException('El pedido no existe');

    await this.prisma.$transaction(async (tx) => {
      // Condicionado al texto visto: si otra persona ya lo resolvió (o apareció otro aviso), no se pisa a ciegas.
      const { count } = await tx.order.updateMany({ where: { id: orderId, paymentIssue: order.paymentIssue }, data: { paymentIssue: null } });
      if (count !== 1 || order.paymentIssue === null) throw new ConflictException('Este aviso ya fue resuelto o cambió. Volvé a cargar.');
      await this.audit.recordIn(tx, {
        actorId,
        action: 'order.payment_issue_resolved',
        entity: 'order',
        entityId: orderId,
        metadata: { number: order.number, paymentId: order.paymentId, issue: order.paymentIssue, resolution: dto.note },
        ip,
      });
    });
  }
}
