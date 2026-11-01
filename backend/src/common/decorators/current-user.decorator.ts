import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { resolveBranchScope } from '../branch-scope';
import type { AuthenticatedRequest } from '../types/authenticated-user';

/** Usuario (personal) autenticado de la request. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

/** Cliente de la tienda autenticado; `undefined` si es anónimo (solo en endpoints @OptionalCustomer()). */
export const CurrentCustomer = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().customer;
});

/**
 * Alcance de sucursal ya resuelto para el usuario actual, a partir de `?branchId=`.
 * Pasarlo directamente al `where` de las consultas garantiza el aislamiento.
 */
export const CurrentBranchScope = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  const requested = typeof request.query.branchId === 'string' ? request.query.branchId : undefined;
  return resolveBranchScope(request.user, requested);
});
