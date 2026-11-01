import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleName } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-user';

/** Guard global: aplica @Roles(). Sin @Roles basta con estar autenticado; SUPERADMIN siempre pasa. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
    if (!user) throw new ForbiddenException('Acceso denegado');
    if (user.role === 'SUPERADMIN' || required.includes(user.role)) return true;
    throw new ForbiddenException('No tienes permisos para esta acción');
  }
}
