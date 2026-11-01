import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId: string | null;
  /** Verbo en formato `entidad.accion`, p. ej. `payment_gateway.updated`. */
  action: string;
  entity: string;
  entityId?: string;
  /** Datos del cambio. NUNCA secretos: solo qué campos cambiaron y valores no sensibles. */
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.recordIn(this.prisma, entry);
  }

  /** Igual que `record`, pero dentro de una transacción: el cambio y su registro se guardan juntos o ninguno. */
  async recordIn(db: Pick<Prisma.TransactionClient, 'auditLog'>, entry: AuditEntry): Promise<void> {
    await db.auditLog.create({ data: entry });
  }
}
