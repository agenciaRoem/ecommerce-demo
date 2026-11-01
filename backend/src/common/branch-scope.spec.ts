import { ForbiddenException } from '@nestjs/common';
import { resolveBranchScope } from './branch-scope';
import type { AuthenticatedUser } from './types/authenticated-user';

const user = (role: AuthenticatedUser['role'], branchId: string | null): AuthenticatedUser => ({
  id: 'u1',
  role,
  branchId,
});

describe('resolveBranchScope', () => {
  it('SUPERADMIN sin filtro tiene alcance global', () => {
    expect(resolveBranchScope(user('SUPERADMIN', null))).toEqual({});
  });

  it('SUPERADMIN puede filtrar por cualquier sucursal', () => {
    expect(resolveBranchScope(user('SUPERADMIN', null), 'b2')).toEqual({ branchId: 'b2' });
  });

  it.each(['GERENTE', 'SALA', 'STOCKEO'] as const)('%s queda forzado a su sucursal', (role) => {
    expect(resolveBranchScope(user(role, 'b1'))).toEqual({ branchId: 'b1' });
    expect(resolveBranchScope(user(role, 'b1'), 'b1')).toEqual({ branchId: 'b1' });
  });

  it('rechaza pedir otra sucursal', () => {
    expect(() => resolveBranchScope(user('SALA', 'b1'), 'b2')).toThrow(ForbiddenException);
  });

  it('rechaza un rol de sucursal sin sucursal asignada', () => {
    expect(() => resolveBranchScope(user('GERENTE', null))).toThrow(ForbiddenException);
  });
});
