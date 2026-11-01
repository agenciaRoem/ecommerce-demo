import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerType, RoleName } from '@prisma/client';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import type { AuthenticatedCustomer, AuthenticatedUser } from '../common/types/authenticated-user';
import type { Audience } from './auth.constants';

interface BaseClaims {
  sub: string;
  iat?: number;
  aud: Audience;
  typ: 'access' | 'refresh';
}

interface StaffAccessClaims extends BaseClaims {
  role: RoleName;
  branchId: string | null;
}

interface CustomerAccessClaims extends BaseClaims {
  customerType: CustomerType;
  verified: boolean;
}

interface RefreshClaims extends BaseClaims {
  jti: string;
}

/**
 * Firma y verifica los JWT. El claim `aud` impide que un token de cliente sirva como token de personal
 * (y viceversa), aunque ambos compartan el secreto.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @InjectConfig() private readonly config: Env,
  ) {}

  signAccess(user: AuthenticatedUser): Promise<string> {
    const claims: StaffAccessClaims = {
      sub: user.id,
      aud: 'staff',
      typ: 'access',
      role: user.role,
      branchId: user.branchId,
    };
    return this.signAccessClaims(claims);
  }

  signCustomerAccess(customer: AuthenticatedCustomer): Promise<string> {
    const claims: CustomerAccessClaims = {
      sub: customer.id,
      aud: 'customer',
      typ: 'access',
      customerType: customer.type,
      verified: customer.verified,
    };
    return this.signAccessClaims(claims);
  }

  signRefresh(aud: Audience, subjectId: string, jti: string): Promise<string> {
    const claims: RefreshClaims = { sub: subjectId, aud, typ: 'refresh', jti };
    return this.jwt.signAsync(claims, {
      secret: this.config.JWT_REFRESH_SECRET,
      expiresIn: this.config.JWT_REFRESH_TTL_SECONDS,
    });
  }

  async verifyAccess(token: string): Promise<AuthenticatedUser> {
    const claims = await this.verify<StaffAccessClaims>(token, this.config.JWT_ACCESS_SECRET, 'staff', 'access');
    return { id: claims.sub, role: claims.role, branchId: claims.branchId, issuedAt: claims.iat };
  }

  async verifyCustomerAccess(token: string): Promise<AuthenticatedCustomer> {
    const claims = await this.verify<CustomerAccessClaims>(token, this.config.JWT_ACCESS_SECRET, 'customer', 'access');
    return { id: claims.sub, type: claims.customerType, verified: claims.verified, issuedAt: claims.iat };
  }

  async verifyRefresh(aud: Audience, token: string): Promise<{ subjectId: string; jti: string; issuedAt?: number }> {
    const claims = await this.verify<RefreshClaims>(token, this.config.JWT_REFRESH_SECRET, aud, 'refresh');
    return { subjectId: claims.sub, jti: claims.jti, issuedAt: claims.iat };
  }

  private signAccessClaims(claims: StaffAccessClaims | CustomerAccessClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.config.JWT_ACCESS_SECRET,
      expiresIn: this.config.JWT_ACCESS_TTL_SECONDS,
    });
  }

  private async verify<T extends BaseClaims>(
    token: string,
    secret: string,
    aud: Audience,
    typ: BaseClaims['typ'],
  ): Promise<T> {
    try {
      const claims = await this.jwt.verifyAsync<T>(token, { secret });
      if (claims.aud !== aud || claims.typ !== typ) throw new Error('token de otro tipo o audiencia');
      return claims;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
  }
}
