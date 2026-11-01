import { Injectable } from '@nestjs/common';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';

/**
 * Registro de refresh tokens vigentes en Redis. Al vivir fuera del proceso,
 * cualquier instancia del backend puede validar, rotar o revocar sesiones.
 */
@Injectable()
export class SessionStore {
  constructor(
    private readonly redis: RedisService,
    @InjectConfig() private readonly config: Env,
  ) {}

  async create(userId: string, jti: string): Promise<void> {
    const ttl = this.config.JWT_REFRESH_TTL_SECONDS;
    await this.redis
      .multi()
      .set(this.tokenKey(jti), userId, 'EX', ttl)
      .sadd(this.userKey(userId), jti)
      .expire(this.userKey(userId), ttl)
      .exec();
  }

  /** Consume el token de forma atómica: devuelve su dueño o `null` si ya fue usado/revocado. */
  async consume(jti: string): Promise<string | null> {
    const userId = await this.redis.getdel(this.tokenKey(jti));
    if (userId) await this.redis.srem(this.userKey(userId), jti);
    return userId;
  }

  async revokeAll(userId: string): Promise<void> {
    const jtis = await this.redis.smembers(this.userKey(userId));
    const pipeline = this.redis.multi();
    // Los tokens ya emitidos no dependen de Redis: se invalidan marcando desde cuándo dejan de valer. La marca dura
    // lo que el refresh token más longevo que pudo haberse emitido.
    pipeline.set(this.revokedKey(userId), Math.floor(Date.now() / 1000), 'EX', this.config.JWT_REFRESH_TTL_SECONDS + 60);
    jtis.forEach((jti) => pipeline.del(this.tokenKey(jti)));
    pipeline.del(this.userKey(userId));
    await pipeline.exec();
  }

  /** Instante (segundos) desde el cual rige la revocación, o `null` si la persona no fue revocada. */
  async revokedAt(userId: string): Promise<number | null> {
    const value = await this.redis.get(this.revokedKey(userId));
    return value === null ? null : Number(value);
  }

  private revokedKey(userId: string) {
    return `auth:revoked-after:${userId}`;
  }

  private tokenKey(jti: string) {
    return `auth:rt:${jti}`;
  }

  private userKey(userId: string) {
    return `auth:user-sessions:${userId}`;
  }
}
