import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import type { Audience } from './auth.constants';

export type EmailTokenPurpose = 'verify-email' | 'reset-password';

export interface EmailTokenOwner {
  audience: Audience;
  subjectId: string;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Enlaces de un solo uso que viajan por correo (verificar email, restablecer contraseña). El token es aleatorio
 * de 256 bits; en Redis solo queda su hash, así que ni una filtración de Redis permite usar los enlaces pendientes.
 * Vencen solos y se consumen de forma atómica. Pedir uno nuevo invalida el anterior de la misma persona.
 */
@Injectable()
export class EmailTokensService {
  constructor(private readonly redis: RedisService) {}

  async issue(purpose: EmailTokenPurpose, owner: EmailTokenOwner, ttlSeconds: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const hash = sha256(token);
    const latestKey = this.latestKey(purpose, owner);

    const previous = await this.redis.get(latestKey);
    const pipeline = this.redis.multi();
    if (previous) pipeline.del(this.tokenKey(purpose, previous));
    pipeline.set(this.tokenKey(purpose, hash), JSON.stringify(owner), 'EX', ttlSeconds);
    pipeline.set(latestKey, hash, 'EX', ttlSeconds);
    await pipeline.exec();
    return token;
  }

  /** Devuelve a quién pertenece y lo invalida; `null` si no existe, ya se usó o venció. */
  async consume(purpose: EmailTokenPurpose, token: string): Promise<EmailTokenOwner | null> {
    const stored = await this.redis.getdel(this.tokenKey(purpose, sha256(token)));
    if (!stored) return null;
    const owner = JSON.parse(stored) as EmailTokenOwner;
    await this.redis.del(this.latestKey(purpose, owner));
    return owner;
  }

  private tokenKey(purpose: EmailTokenPurpose, hash: string): string {
    return `auth:email-token:${purpose}:${hash}`;
  }

  private latestKey(purpose: EmailTokenPurpose, owner: EmailTokenOwner): string {
    return `auth:email-token-latest:${purpose}:${owner.audience}:${owner.subjectId}`;
  }
}
