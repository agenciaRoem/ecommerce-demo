import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Audience } from './auth.constants';
import { SessionStore } from './session.store';
import { TokenService } from './token.service';

/**
 * Ciclo de vida de los refresh tokens, común al personal y a los clientes:
 * abrir una sesión, rotarla (con detección de reutilización) y cerrarla.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly tokens: TokenService,
    private readonly store: SessionStore,
  ) {}

  /** Registra una sesión nueva y devuelve su refresh token. */
  async open(aud: Audience, subjectId: string): Promise<string> {
    const jti = randomUUID();
    await this.store.create(subjectId, jti);
    return this.tokens.signRefresh(aud, subjectId, jti);
  }

  /**
   * Consume el refresh token y devuelve a quién pertenece. Reutilizar uno ya consumido indica robo:
   * se revocan todas las sesiones de esa persona.
   */
  async consume(aud: Audience, refreshToken: string): Promise<string> {
    const { subjectId, jti, issuedAt } = await this.tokens.verifyRefresh(aud, refreshToken);
    // Una sesión que se cerró a propósito (cambio de contraseña, baja) no es un robo: se rechaza sin cerrar, además,
    // las sesiones nuevas de la misma persona.
    if (issuedAt !== undefined && (await this.isAccessRevoked(subjectId, issuedAt))) throw new UnauthorizedException('Sesión inválida o expirada');
    const owner = await this.store.consume(jti);
    if (owner !== subjectId) {
      await this.store.revokeAll(subjectId);
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    return subjectId;
  }

  /** Idempotente: si el token ya no sirve, no hay nada que revocar. */
  async close(aud: Audience, refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const { jti } = await this.tokens.verifyRefresh(aud, refreshToken);
      await this.store.consume(jti);
    } catch {
      // token inválido o expirado: la sesión ya no es utilizable
    }
  }

  /** `true` si el access token se emitió antes de que se revocaran las sesiones de su dueño. */
  async isAccessRevoked(subjectId: string, issuedAt: number): Promise<boolean> {
    const revokedAt = await this.store.revokedAt(subjectId);
    return revokedAt !== null && issuedAt <= revokedAt;
  }

  /** Cierra todas las sesiones de una persona (baja de usuario, cambio de contraseña o de rol), incluido el acceso ya emitido. */
  revokeAll(subjectId: string): Promise<void> {
    return this.store.revokeAll(subjectId);
  }
}
