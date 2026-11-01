import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Page, skipTake } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListAuditQuery } from './audit-admin.schemas';

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { id: string; fullName: string; email: string } | null;
  metadata: Prisma.JsonValue;
  ip: string | null;
}

/** Consulta del registro de auditoría (solo lectura: la tabla es inmutable). */
@Injectable()
export class AuditAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditQuery): Promise<Page<AuditRow>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity && { entity: query.entity }),
      ...(query.action && { action: query.action }),
      ...(query.actorId && { actorId: query.actorId }),
      // Las fechas son días calendario; se interpretan en UTC para que el filtro sea determinista.
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(`${query.from}T00:00:00.000Z`) }),
          ...(query.to && { lt: new Date(Date.parse(`${query.to}T00:00:00.000Z`) + 24 * 60 * 60 * 1000) }),
        },
      }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...skipTake(query),
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        actor: row.actor,
        metadata: row.metadata,
        ip: row.ip,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Valores existentes para armar los filtros. */
  async facets() {
    const [entities, actions] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ['entity'], orderBy: { entity: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
    ]);
    return { entities: entities.map((row) => row.entity), actions: actions.map((row) => row.action) };
  }
}
