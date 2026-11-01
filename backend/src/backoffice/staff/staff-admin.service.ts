import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../audit/audit.service';
import { SessionService } from '../../auth/session.service';
import { Page, skipTake } from '../../common/pagination';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateStaffDto, ListStaffQuery, UpdateStaffDto } from './staff-admin.schemas';

const staffInclude = { role: { select: { name: true } }, branch: { select: { id: true, name: true } } } satisfies Prisma.UserInclude;
type StaffRecord = Prisma.UserGetPayload<{ include: typeof staffInclude }>;

export interface StaffView {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  branch: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
}

const toView = (user: StaffRecord): StaffView => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role.name,
  branch: user.branch,
  isActive: user.isActive,
  createdAt: user.createdAt.toISOString(),
});

/**
 * Alta, cambio de rol/sucursal y baja del personal. Nunca devuelve ni registra contraseñas. Cualquier cambio que
 * altere lo que la persona puede hacer cierra sus sesiones: el próximo ingreso ya lleva el rol nuevo.
 */
@Injectable()
export class StaffAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: ListStaffQuery): Promise<Page<StaffView>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role && { role: { name: query.role } }),
      ...(query.branchId && { branchId: query.branchId }),
      ...(query.status !== 'all' && { isActive: query.status === 'active' }),
      ...(query.search && {
        OR: [{ fullName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }],
      }),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, include: staffInclude, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }, { id: 'asc' }], ...skipTake(query) }),
    ]);
    return { items: users.map(toView), total, page: query.page, limit: query.limit };
  }

  async create(actorId: string, dto: CreateStaffDto, ip?: string): Promise<StaffView> {
    await this.assertBranchIsUsable(dto.branchId);
    const role = await this.roleId(dto.role);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            passwordHash: await argon2.hash(dto.password),
            roleId: role,
            branchId: dto.branchId ?? null,
          },
          include: staffInclude,
        });
        await this.audit.recordIn(tx, {
          actorId,
          action: 'staff.created',
          entity: 'user',
          entityId: created.id,
          metadata: { email: created.email, role: dto.role, branchId: dto.branchId ?? null },
          ip,
        });
        return created;
      });
      return toView(user);
    } catch (error) {
      if (isUniqueViolation(error, 'email')) throw new ConflictException('Ya existe un usuario con ese email');
      throw error;
    }
  }

  async update(actorId: string, id: string, dto: UpdateStaffDto, ip?: string): Promise<StaffView> {
    const current = await this.prisma.user.findUnique({ where: { id }, include: staffInclude });
    if (!current) throw new NotFoundException('El usuario no existe');

    const role = dto.role ?? current.role.name;
    const branchId = role === 'SUPERADMIN' ? null : dto.branchId === undefined ? current.branchId : dto.branchId;
    if (role !== 'SUPERADMIN' && !branchId) throw new BadRequestException('Elegí la sucursal de este rol');
    if (role === 'SUPERADMIN' && dto.branchId) throw new BadRequestException('El superadmin es global: no lleva sucursal');
    if (branchId !== current.branchId) await this.assertBranchIsUsable(branchId ?? undefined);

    const losesAccess = dto.isActive === false || role !== current.role.name;
    if (id === actorId && losesAccess) throw new BadRequestException('No podés quitarte el acceso ni cambiarte el rol a vos mismo');
    if (current.role.name === 'SUPERADMIN' && losesAccess) await this.assertAnotherSuperadmin(id);

    const changes = {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(role !== current.role.name && { roleId: await this.roleId(role) }),
      ...(branchId !== current.branchId && { branchId }),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: changes, include: staffInclude });
      await this.audit.recordIn(tx, {
        actorId,
        action: dto.isActive === false && current.isActive ? 'staff.deactivated' : dto.isActive === true && !current.isActive ? 'staff.reactivated' : 'staff.updated',
        entity: 'user',
        entityId: id,
        metadata: {
          email: current.email,
          ...(dto.fullName !== undefined && { fullName: { from: current.fullName, to: dto.fullName } }),
          ...(role !== current.role.name && { role: { from: current.role.name, to: role } }),
          ...(branchId !== current.branchId && { branchId: { from: current.branchId, to: branchId } }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        ip,
      });
      return user;
    });

    // Rol, sucursal o baja cambian lo que puede hacer: se cierran sus sesiones para que no siga con permisos viejos.
    if (losesAccess || branchId !== current.branchId) await this.sessions.revokeAll(id);
    return toView(updated);
  }

  /** El superadmin define una contraseña nueva (p. ej. porque la persona la olvidó). Cierra todas sus sesiones. */
  async resetPassword(actorId: string, id: string, password: string, ip?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) throw new NotFoundException('El usuario no existe');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await argon2.hash(password) } });
      await this.audit.recordIn(tx, { actorId, action: 'staff.password_reset', entity: 'user', entityId: id, metadata: { email: user.email }, ip });
    });
    await this.sessions.revokeAll(id);
  }

  private async roleId(name: RoleName): Promise<string> {
    const role = await this.prisma.role.findUnique({ where: { name }, select: { id: true } });
    if (!role) throw new BadRequestException('El rol no existe');
    return role.id;
  }

  private async assertBranchIsUsable(branchId: string | undefined): Promise<void> {
    if (!branchId) return;
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { isActive: true } });
    if (!branch) throw new BadRequestException('La sucursal no existe');
    if (!branch.isActive) throw new BadRequestException('La sucursal está dada de baja');
  }

  /** Siempre tiene que quedar alguien con acceso total, o nadie podría administrar el sistema. */
  private async assertAnotherSuperadmin(excludingId: string): Promise<void> {
    const others = await this.prisma.user.count({ where: { id: { not: excludingId }, isActive: true, role: { name: 'SUPERADMIN' } } });
    if (others === 0) throw new BadRequestException('Tiene que quedar al menos un superadmin activo');
  }
}
