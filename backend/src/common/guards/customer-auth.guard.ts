import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { COOKIES } from '../../auth/auth.constants';
import { SessionService } from '../../auth/session.service';
import { TokenService } from '../../auth/token.service';
import { CUSTOMER_ACCESS_KEY, CustomerAccess } from '../decorators/audience.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-user';

/** Guard global de clientes: actúa solo en endpoints marcados con @CustomerOnly() u @OptionalCustomer(). */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = this.reflector.getAllAndOverride<CustomerAccess | undefined>(CUSTOMER_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!access) return true;

    const request = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const token = request.cookies?.[COOKIES.customer.access] as string | undefined;

    if (!token) {
      if (access === 'optional') return true;
      throw new UnauthorizedException('Autenticación requerida');
    }

    try {
      const customer = await this.tokens.verifyCustomerAccess(token);
      // Cambiar la contraseña cierra todas las sesiones al instante, también el acceso ya emitido.
      if (customer.issuedAt !== undefined && (await this.sessions.isAccessRevoked(customer.id, customer.issuedAt))) {
        throw new UnauthorizedException('Sesión inválida o expirada');
      }
      request.customer = customer;
    } catch (error) {
      // Con sesión opcional, un token vencido equivale a navegar como anónimo.
      if (access === 'required') throw error;
    }
    return true;
  }
}
