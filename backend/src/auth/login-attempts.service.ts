import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import type { Audience } from './auth.constants';

/** Intentos fallidos que tolera una cuenta antes de bloquearse un rato. */
export const MAX_FAILED_LOGINS = 10;
export const LOCK_WINDOW_SECONDS = 15 * 60;

/**
 * Límite de intentos por CUENTA, además del límite por IP: frena a quien prueba contraseñas desde muchas
 * direcciones a la vez. Se cuenta por email exista o no la cuenta, para no revelar cuáles existen. El bloqueo es
 * corto y se levanta solo; una contraseña correcta antes de llegar al tope borra la cuenta de fallos.
 */
@Injectable()
export class LoginAttemptsService {
  constructor(private readonly redis: RedisService) {}

  async assertAllowed(audience: Audience, email: string): Promise<void> {
    const failures = Number((await this.redis.get(this.key(audience, email))) ?? 0);
    if (failures >= MAX_FAILED_LOGINS) {
      throw new HttpException('Demasiados intentos fallidos. Probá de nuevo en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(audience: Audience, email: string): Promise<void> {
    const key = this.key(audience, email);
    if ((await this.redis.incr(key)) === 1) await this.redis.expire(key, LOCK_WINDOW_SECONDS);
  }

  async reset(audience: Audience, email: string): Promise<void> {
    await this.redis.del(this.key(audience, email));
  }

  /** Se guarda un hash, no el email: Redis no tiene que contener direcciones de personas. */
  private key(audience: Audience, email: string): string {
    return `auth:failed-logins:${audience}:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
  }
}
