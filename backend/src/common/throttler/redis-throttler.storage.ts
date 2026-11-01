import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/redis.service';

/**
 * Cuenta los pedidos de cada cliente en una ventana fija, de forma atómica (un script Lua) y en Redis: así el
 * límite es el mismo con varias instancias del backend y sobrevive a un reinicio. Si se pasa del límite y hay
 * `blockDuration`, el bloqueo dura ese tiempo; si no, hasta que termine la ventana.
 */
const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 or redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if hits == tonumber(ARGV[2]) + 1 and tonumber(ARGV[3]) > 0 then redis.call('PEXPIRE', KEYS[1], ARGV[3]) end
return { hits, redis.call('PTTL', KEYS[1]) }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const [hits, pttl] = (await this.redis.eval(INCREMENT, 1, `throttle:${throttlerName}:${key}`, ttl, limit, blockDuration)) as [number, number];
    const seconds = Math.max(Math.ceil(pttl / 1000), 0);
    const isBlocked = hits > limit;
    return { totalHits: hits, timeToExpire: seconds, isBlocked, timeToBlockExpire: isBlocked ? seconds : 0 };
  }
}
