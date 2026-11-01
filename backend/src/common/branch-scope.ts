import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from './types/authenticated-user';

/** Filtro listo para usar en `where` de Prisma. Vacío = alcance global (todas las sucursales). */
export interface BranchScope {
  branchId?: string;
}

/**
 * Aislamiento por sucursal:
 * - SUPERADMIN (sin sucursal) ve todo, o filtra por la sucursal que pida.
 * - Cualquier otro rol queda forzado a su propia sucursal; pedir otra es un error.
 */
export function resolveBranchScope(user: AuthenticatedUser, requestedBranchId?: string): BranchScope {
  if (user.role === 'SUPERADMIN') {
    return requestedBranchId ? { branchId: requestedBranchId } : {};
  }
  if (!user.branchId) {
    throw new ForbiddenException('El usuario no tiene una sucursal asignada');
  }
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new ForbiddenException('No tienes acceso a esa sucursal');
  }
  return { branchId: user.branchId };
}

/** Para escrituras: exige una sucursal concreta (el SUPERADMIN debe indicarla con `?branchId=`). */
export function requireBranchId(scope: BranchScope): string {
  if (!scope.branchId) {
    throw new BadRequestException('Indica la sucursal con ?branchId=');
  }
  return scope.branchId;
}
