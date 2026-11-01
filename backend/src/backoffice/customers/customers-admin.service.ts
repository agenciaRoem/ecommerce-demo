import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { Page, skipTake } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListCommerceQuery, VerifyCuitDto } from './customers-admin.schemas';

export interface CommerceView {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  cuit: string;
  cuitVerified: boolean;
  isActive: boolean;
  createdAt: string;
  orders: number;
}

/** 30500010912 → 30-50001091-2 */
const formatCuit = (cuit: string) => `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;

/**
 * Aprobación de comercios (B2B). El sistema valida el formato del CUIT al registrarse pero no lo consulta en
 * ARCA: una persona comprueba la constancia y aprueba acá. Hasta entonces el comercio compra a precio minorista.
 */
@Injectable()
export class CustomersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCommerce(query: ListCommerceQuery): Promise<Page<CommerceView>> {
    const where: Prisma.CustomerWhereInput = {
      type: 'COMMERCE',
      ...(query.status !== 'all' && { cuitVerified: query.status === 'verified' }),
      ...(query.search && { OR: this.searchClauses(query.search) }),
    };
    const [total, customers] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // los que esperan hace más van primero
        ...skipTake(query),
      }),
    ]);
    return {
      items: customers.map((customer) => ({
        id: customer.id,
        businessName: customer.businessName ?? customer.fullName,
        contactName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        cuit: formatCuit(customer.cuit ?? ''),
        cuitVerified: customer.cuitVerified,
        isActive: customer.isActive,
        createdAt: customer.createdAt.toISOString(),
        orders: customer._count.orders,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private searchClauses(search: string): Prisma.CustomerWhereInput[] {
    const digits = search.replace(/\D/g, '');
    return [
      { businessName: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      ...(digits ? [{ cuit: { contains: digits } }] : []),
    ];
  }

  async setCuitVerification(actorId: string, id: string, dto: VerifyCuitDto, ip?: string): Promise<{ cuitVerified: boolean }> {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { type: true, cuit: true, cuitVerified: true, businessName: true } });
    if (!customer) throw new NotFoundException('El cliente no existe');
    if (customer.type !== 'COMMERCE' || !customer.cuit) throw new BadRequestException('Solo los comercios tienen CUIT para verificar');

    if (customer.cuitVerified !== dto.verified) {
      await this.prisma.$transaction(async (tx) => {
        await tx.customer.update({ where: { id }, data: { cuitVerified: dto.verified } });
        await this.audit.recordIn(tx, {
          actorId,
          action: dto.verified ? 'customer.cuit_verified' : 'customer.cuit_revoked',
          entity: 'customer',
          entityId: id,
          metadata: { businessName: customer.businessName, cuit: customer.cuit, note: dto.note },
          ip,
        });
      });
    }
    return { cuitVerified: dto.verified };
  }
}
