import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { MailService } from '../mail/mail.service';
import { passwordChangedEmail, passwordResetEmail, verificationEmail } from '../mail/mail.templates';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { Audience } from './auth.constants';
import { EmailTokensService } from './email-tokens.service';
import { LoginAttemptsService } from './login-attempts.service';
import { SessionService } from './session.service';

export const VERIFY_EMAIL_TTL_SECONDS = 24 * 60 * 60;
export const RESET_PASSWORD_TTL_SECONDS = 60 * 60;
/** Mínimo entre dos pedidos de correo para la misma cuenta (frena el uso de la tienda para llenar de correo a alguien). */
const MAIL_COOLDOWN_SECONDS = 60;

const INVALID_LINK = 'El enlace no es válido o ya venció. Pedí uno nuevo.';

/** Dónde vive cada pantalla a la que apuntan los enlaces de los correos. */
const RESET_PATH: Record<Audience, string> = { customer: '/cuenta/restablecer', staff: '/recuperar/restablecer' };

interface Account {
  id: string;
  email: string;
  name: string;
}

/**
 * Verificación de email y recuperación de contraseña por correo, para clientes y personal.
 * Regla de oro: **nunca** revelar si un email tiene cuenta. Pedir un restablecimiento responde siempre lo mismo.
 */
@Injectable()
export class AccountRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: EmailTokensService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    private readonly attempts: LoginAttemptsService,
    @InjectConfig() private readonly config: Env,
  ) {}

  // ───────── Restablecer contraseña ─────────

  /** Si existe una cuenta activa con ese email, le manda el enlace. Siempre termina igual para quien pregunta. */
  async requestPasswordReset(audience: Audience, email: string): Promise<void> {
    const account = await this.findActive(audience, email);
    if (!account) return;
    if (!(await this.claimCooldown('reset', audience, account.id))) return;

    const token = await this.tokens.issue('reset-password', { audience, subjectId: account.id }, RESET_PASSWORD_TTL_SECONDS);
    this.mail.sendInBackground(passwordResetEmail(this.config.STORE_NAME, account.email, account.name, this.link(RESET_PATH[audience], token)));
  }

  async completePasswordReset(audience: Audience, token: string, password: string): Promise<void> {
    const owner = await this.tokens.consume('reset-password', token);
    if (!owner || owner.audience !== audience) throw new BadRequestException(INVALID_LINK);

    const passwordHash = await argon2.hash(password);
    const account =
      audience === 'staff'
        ? await this.prisma.user.update({ where: { id: owner.subjectId }, data: { passwordHash }, select: { id: true, email: true, fullName: true, isActive: true } })
        : await this.prisma.customer.update({
            where: { id: owner.subjectId },
            // Llegar con el enlace del correo prueba que el email es suyo.
            data: { passwordHash, emailVerifiedAt: new Date() },
            select: { id: true, email: true, fullName: true, isActive: true },
          });
    if (!account.isActive) throw new BadRequestException(INVALID_LINK);

    // Cualquier sesión abierta (la de quien se la robó, por ejemplo) deja de servir, y los intentos fallidos se borran.
    await this.sessions.revokeAll(account.id);
    await this.attempts.reset(audience, account.email);
    this.mail.sendInBackground(passwordChangedEmail(this.config.STORE_NAME, account.email, account.fullName));
  }

  // ───────── Verificar email (clientes) ─────────

  /** Manda (o reenvía) el enlace de verificación. No hace nada si el email ya está verificado. */
  async sendVerification(customerId: string, options: { enforceCooldown: boolean }): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, email: true, fullName: true, emailVerifiedAt: true, isActive: true } });
    if (!customer?.isActive) throw new NotFoundException('La cuenta no existe');
    if (customer.emailVerifiedAt) return;
    if (options.enforceCooldown && !(await this.claimCooldown('verify', 'customer', customer.id))) return;

    const token = await this.tokens.issue('verify-email', { audience: 'customer', subjectId: customer.id }, VERIFY_EMAIL_TTL_SECONDS);
    this.mail.sendInBackground(verificationEmail(this.config.STORE_NAME, customer.email, customer.fullName, this.link('/cuenta/verificar', token)));
  }

  async verifyEmail(token: string): Promise<void> {
    const owner = await this.tokens.consume('verify-email', token);
    if (!owner || owner.audience !== 'customer') throw new BadRequestException(INVALID_LINK);
    // `updateMany` con la condición: verificar dos veces el mismo email no cambia la fecha original.
    await this.prisma.customer.updateMany({ where: { id: owner.subjectId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  }

  // ───────── Interno ─────────

  private async findActive(audience: Audience, email: string): Promise<Account | null> {
    if (audience === 'staff') {
      const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, fullName: true, isActive: true } });
      return user?.isActive ? { id: user.id, email: user.email, name: user.fullName } : null;
    }
    const customer = await this.prisma.customer.findUnique({ where: { email }, select: { id: true, email: true, fullName: true, isActive: true } });
    return customer?.isActive ? { id: customer.id, email: customer.email, name: customer.fullName } : null;
  }

  /** `true` si pasó el tiempo mínimo desde el último pedido de esta cuenta; reserva el turno de forma atómica. */
  private async claimCooldown(kind: 'reset' | 'verify', audience: Audience, subjectId: string): Promise<boolean> {
    const key = `auth:mail-cooldown:${kind}:${audience}:${createHash('sha256').update(subjectId).digest('hex')}`;
    return (await this.redis.set(key, '1', 'EX', MAIL_COOLDOWN_SECONDS, 'NX')) === 'OK';
  }

  private link(path: string, token: string): string {
    return `${this.config.PUBLIC_STORE_URL}${path}?token=${encodeURIComponent(token)}`;
  }
}
