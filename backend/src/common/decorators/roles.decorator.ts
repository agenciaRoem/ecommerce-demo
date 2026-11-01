import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a los roles indicados (SUPERADMIN siempre tiene acceso). */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
