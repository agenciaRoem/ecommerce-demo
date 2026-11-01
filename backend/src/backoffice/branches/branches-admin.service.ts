import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBranchDto, UpdateBranchDto } from './branches-admin.schemas';

/** Pedidos que todavía no terminaron: una sucursal con alguno de estos no se puede dar de baja. */
const OPEN_STATUSES = ['PENDING_PAYMENT', 'PENDING', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'READY_FOR_FREIGHT'] as const;

@Injectable()
export class BranchesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const [branches, staff, openOrders] = await Promise.all([
      this.prisma.branch.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
      this.prisma.user.groupBy({ by: ['branchId'], where: { isActive: true, branchId: { not: null } }, _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['branchId'], where: { status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } }),
    ]);
    const staffBy = new Map(staff.map((row) => [row.branchId, row._count._all]));
    const ordersBy = new Map(openOrders.map((row) => [row.branchId, row._count._all]));
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.isActive,
      activeStaff: staffBy.get(branch.id) ?? 0,
      openOrders: ordersBy.get(branch.id) ?? 0,
    }));
  }

  async create(actorId: string, dto: CreateBranchDto, ip?: string) {
    try {
      const branch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.branch.create({ data: dto });
        await this.audit.recordIn(tx, {
          actorId,
          action: 'branch.created',
          entity: 'branch',
          entityId: created.id,
          metadata: { name: created.name, code: created.code },
          ip,
        });
        return created;
      });
      return { ...branch, activeStaff: 0, openOrders: 0 };
    } catch (error) {
      if (isUniqueViolation(error, 'code')) throw new ConflictException('Ya existe una sucursal con esa sigla');
      if (isUniqueViolation(error, 'name')) throw new ConflictException('Ya existe una sucursal con ese nombre');
      throw error;
    }
  }

  async update(actorId: string, id: string, dto: UpdateBranchDto, ip?: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('La sucursal no existe');

    if (dto.isActive === false && branch.isActive) await this.assertCanDeactivate(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.branch.update({ where: { id }, data: dto });
        await this.audit.recordIn(tx, {
          actorId,
          action: dto.isActive === undefined || dto.isActive === branch.isActive ? 'branch.updated' : dto.isActive ? 'branch.activated' : 'branch.deactivated',
          entity: 'branch',
          entityId: id,
          metadata: { code: branch.code, changes: Object.keys(dto) },
          ip,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, 'name')) throw new ConflictException('Ya existe una sucursal con ese nombre');
      throw error;
    }
    return (await this.list()).find((row) => row.id === id);
  }

  /** La tienda necesita al menos una sucursal abierta, y una con pedidos sin terminar dejaría clientes colgados. */
  private async assertCanDeactivate(id: string): Promise<void> {
    const [otherActive, open] = await Promise.all([
      this.prisma.branch.count({ where: { isActive: true, id: { not: id } } }),
      this.prisma.order.count({ where: { branchId: id, status: { in: [...OPEN_STATUSES] } } }),
    ]);
    if (otherActive === 0) throw new BadRequestException('La tienda necesita al menos una sucursal activa');
    if (open > 0) throw new ConflictException(`La sucursal tiene ${open} pedido(s) sin terminar. Cerralos o esperá a que se entreguen.`);
  }
}
