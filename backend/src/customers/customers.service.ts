import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AccountRecoveryService } from '../auth/account-recovery.service';
import { LoginAttemptsService } from '../auth/login-attempts.service';
import { SessionService } from '../auth/session.service';
import type { TokenPair } from '../auth/cookie.service';
import { TokenService } from '../auth/token.service';
import { isUniqueViolation } from '../common/prisma-errors';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterCustomerDto } from './customers.schemas';

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  type: CustomerType;
  phone: string | null;
  businessName: string | null;
  cuit: string | null;
  /** Un comercio con CUIT sin aprobar compra como minorista hasta que el personal lo verifique. */
  cuitVerified: boolean;
  /** El email se comprobó (enlace del correo o ingreso con Google). Sin esto no se puede comprar. */
  emailVerified: boolean;
  shippingAddress: string | null;
}

export interface CustomerAuthResult {
  customer: CustomerProfile;
  tokens: TokenPair;
}

type CustomerRecord = Omit<CustomerProfile, 'emailVerified'> & { emailVerifiedAt: Date | null; isActive: boolean };

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const INVALID_SESSION = 'Sesión inválida o expirada';

const PROFILE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  type: true,
  phone: true,
  businessName: true,
  cuit: true,
  cuitVerified: true,
  emailVerifiedAt: true,
  shippingAddress: true,
  isActive: true,
} as const;

/** Cuentas de clientes de la tienda: minoristas (RETAIL) y comercios (COMMERCE / B2B). */
@Injectable()
export class CustomersService implements OnModuleInit {
  /** Hash descartable para igualar el tiempo de respuesta cuando el email no existe. */
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash(randomUUID());
  }

  async register(dto: RegisterCustomerDto): Promise<CustomerAuthResult> {
    const isCommerce = dto.type === 'COMMERCE';
    try {
      const customer = await this.prisma.customer.create({
        data: {
          type: dto.type,
          email: dto.email,
          passwordHash: await argon2.hash(dto.password),
          fullName: dto.fullName,
          phone: dto.phone,
          ...(isCommerce && {
            businessName: dto.businessName,
            cuit: dto.cuit,
            shippingAddress: dto.shippingAddress,
          }),
        },
        select: PROFILE_SELECT,
      });
      // Sin esperar y sin fallar: si el correo no sale ahora, el cliente puede pedir que se reenvíe.
      this.recovery.sendVerification(customer.id, { enforceCooldown: false }).catch(() => undefined);
      return this.startSession(customer);
    } catch (error) {
      if (isUniqueViolation(error, 'email')) throw new ConflictException('Ya existe una cuenta con ese email');
      if (isUniqueViolation(error, 'cuit')) throw new ConflictException('Ya existe una cuenta con ese CUIT');
      throw error;
    }
  }

  async login(email: string, password: string): Promise<CustomerAuthResult> {
    await this.attempts.assertAllowed('customer', email);
    const customer = await this.prisma.customer.findUnique({
      where: { email },
      select: { ...PROFILE_SELECT, passwordHash: true },
    });
    const valid = await argon2.verify(customer?.passwordHash ?? this.dummyHash, password);
    if (!customer || !valid || !customer.isActive) {
      await this.attempts.recordFailure('customer', email);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.attempts.reset('customer', email);
    return this.startSession(customer);
  }

  /**
   * Ingreso con un email que un proveedor externo (Google) ya comprobó. Si la cuenta existe entra a ella (y queda
   * con el email verificado); si no, se crea una cuenta de particular sin contraseña (puede definir una con
   * "Olvidé mi contraseña"). Los comercios se registran por el formulario porque necesitan CUIT.
   */
  async signInWithVerifiedEmail(profile: { email: string; name?: string }): Promise<CustomerAuthResult> {
    const existing = await this.prisma.customer.findUnique({ where: { email: profile.email }, select: PROFILE_SELECT });
    if (existing) {
      if (!existing.isActive) throw new UnauthorizedException(INVALID_CREDENTIALS);
      if (!existing.emailVerifiedAt) {
        const verified = await this.prisma.customer.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() }, select: PROFILE_SELECT });
        return this.startSession(verified);
      }
      return this.startSession(existing);
    }

    const created = await this.prisma.customer.create({
      data: {
        type: 'RETAIL',
        email: profile.email,
        fullName: (profile.name?.trim() || profile.email.split('@')[0]).slice(0, 120),
        // Hash de una clave aleatoria que nadie conoce: la cuenta solo entra por Google hasta que se defina una contraseña.
        passwordHash: await argon2.hash(randomUUID() + randomUUID()),
        emailVerifiedAt: new Date(),
      },
      select: PROFILE_SELECT,
    });
    return this.startSession(created);
  }

  async refresh(refreshToken: string): Promise<CustomerAuthResult> {
    const customerId = await this.sessions.consume('customer', refreshToken);
    // El estado de verificación del CUIT se relee de la base en cada renovación.
    return this.startSession(await this.findActive(customerId));
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.sessions.close('customer', refreshToken);
  }

  async getProfile(customerId: string): Promise<CustomerProfile> {
    return this.toProfile(await this.findActive(customerId));
  }

  private async findActive(customerId: string): Promise<CustomerRecord> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: PROFILE_SELECT });
    if (!customer?.isActive) throw new UnauthorizedException(INVALID_SESSION);
    return customer;
  }

  private async startSession(customer: CustomerRecord): Promise<CustomerAuthResult> {
    const principal: AuthenticatedCustomer = {
      id: customer.id,
      type: customer.type,
      verified: customer.type === 'COMMERCE' && customer.cuitVerified,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signCustomerAccess(principal),
      this.sessions.open('customer', customer.id),
    ]);
    return { customer: this.toProfile(customer), tokens: { accessToken, refreshToken } };
  }

  /** Quita campos internos (p. ej. `isActive`, `passwordHash`) antes de responder. */
  private toProfile(customer: CustomerRecord): CustomerProfile {
    const { id, email, fullName, type, phone, businessName, cuit, cuitVerified, emailVerifiedAt, shippingAddress } = customer;
    return { id, email, fullName, type, phone, businessName, cuit, cuitVerified, emailVerified: emailVerifiedAt !== null, shippingAddress };
  }
}
