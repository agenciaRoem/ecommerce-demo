import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { COOKIES } from '../../auth/auth.constants';
import { SessionService } from '../../auth/session.service';
import { TokenService } from '../../auth/token.service';
import { CUSTOMER_ACCESS_KEY } from '../decorators/audience.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-user';

/**
 * Guard global del personal: exige un access token válido (cookie HttpOnly) salvo en endpoints
 * @Public() o de clientes (que valida CustomerAuthGuard).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<string | undefined>(CUSTOMER_ACCESS_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const token = request.cookies?.[COOKIES.staff.access] as string | undefined;
    if (!token) throw new UnauthorizedException('Autenticación requerida');

    const user = await this.tokens.verifyAccess(token);
    // Una baja (o un cambio de rol) vale al instante, no cuando venza el token.
    if (user.issuedAt !== undefined && (await this.sessions.isAccessRevoked(user.id, user.issuedAt))) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    request.user = user;
    return true;
  }
}
