import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleName } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextFor(user: { role: RoleName } | undefined, required: RoleName[] | undefined) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('permite cualquier usuario autenticado si no hay @Roles', () => {
    const { guard, context } = contextFor({ role: 'SALA' }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite un rol incluido', () => {
    const { guard, context } = contextFor({ role: 'GERENTE' }, ['GERENTE']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('SUPERADMIN pasa siempre', () => {
    const { guard, context } = contextFor({ role: 'SUPERADMIN' }, ['STOCKEO']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza un rol no incluido', () => {
    const { guard, context } = contextFor({ role: 'SALA' }, ['GERENTE']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario en la request', () => {
    const { guard, context } = contextFor(undefined, ['GERENTE']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
