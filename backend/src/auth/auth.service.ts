import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { TokenPair } from './cookie.service';
import { LoginAttemptsService } from './login-attempts.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

export interface UserProfile extends AuthenticatedUser {
  email: string;
  fullName: string;
  branchName: string | null;
}

export interface AuthResult {
  user: UserProfile;
  tokens: TokenPair;
}

interface StaffRecord {
  id: string;
  email: string;
  fullName: string;
  branchId: string | null;
  role: { name: UserProfile['role'] };
  branch: { name: string } | null;
}

const USER_INCLUDE = { role: true, branch: { select: { name: true } } } as const;

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const INVALID_SESSION = 'Sesión inválida o expirada';

/** Autenticación del personal interno (usuarios con rol y sucursal). */
@Injectable()
export class AuthService implements OnModuleInit {
  /** Hash descartable para igualar el tiempo de respuesta cuando el email no existe. */
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash(randomUUID());
  }

  async login(email: string, password: string): Promise<AuthResult> {
    await this.attempts.assertAllowed('staff', email);
    const user = await this.prisma.user.findUnique({ where: { email }, include: USER_INCLUDE });
    const valid = await argon2.verify(user?.passwordHash ?? this.dummyHash, password);
    if (!user || !valid || !user.isActive) {
      await this.attempts.recordFailure('staff', email);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    await this.attempts.reset('staff', email);
    return this.startSession(this.toProfile(user));
  }

  /** Rota el refresh token. Reutilizar uno ya consumido revoca todas las sesiones del usuario. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const userId = await this.sessions.consume('staff', refreshToken);

    // El rol y la sucursal se releen de la base: los cambios aplican como máximo al próximo refresh.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });
    if (!user?.isActive) throw new UnauthorizedException(INVALID_SESSION);
    return this.startSession(this.toProfile(user));
  }

  logout(refreshToken: string | undefined): Promise<void> {
    return this.sessions.close('staff', refreshToken);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });
    if (!user?.isActive) throw new UnauthorizedException(INVALID_SESSION);
    return this.toProfile(user);
  }

  private async startSession(user: UserProfile): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(user),
      this.sessions.open('staff', user.id),
    ]);
    return { user, tokens: { accessToken, refreshToken } };
  }

  private toProfile(user: StaffRecord): UserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
    };
  }
}
