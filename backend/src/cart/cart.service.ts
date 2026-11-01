import { BadRequestException, Injectable } from '@nestjs/common';
import type { StockLine } from '../inventory/stock-reservation.service';
import { RedisService } from '../redis/redis.service';

export const CART_MAX_LINES = 50;
export const CART_MAX_QUANTITY = 999;
const CART_TTL_SECONDS = 30 * 24 * 60 * 60;

const cartKey = (customerId: string) => `cart:${customerId}`;
/** Última vez que cada cliente tocó su carrito (puntaje = instante en ms). Permite detectar carritos abandonados sin recorrer Redis. */
export const CART_ACTIVITY_KEY = 'carts:activity';

/**
 * Carrito de cada cliente en Redis: un hash `productId → cantidad`. Guarda solo qué quiere y cuánto; los
 * precios y la disponibilidad se calculan al mirarlo, así nunca quedan desactualizados. Vive fuera del
 * proceso, por lo que cualquier instancia del backend ve el mismo carrito.
 */
@Injectable()
export class CartService {
  constructor(private readonly redis: RedisService) {}

  async lines(customerId: string): Promise<StockLine[]> {
    const stored = await this.redis.hgetall(cartKey(customerId));
    return Object.entries(stored)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }))
      .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
  }

  async count(customerId: string): Promise<number> {
    return (await this.lines(customerId)).reduce((total, line) => total + line.quantity, 0);
  }

  /** Suma unidades a un producto (lo agrega si no estaba). */
  async add(customerId: string, productId: string, quantity: number): Promise<void> {
    const key = cartKey(customerId);
    await this.assertRoomFor(key, productId);

    const total = await this.redis.hincrby(key, productId, quantity);
    if (total > CART_MAX_QUANTITY) await this.redis.hset(key, productId, CART_MAX_QUANTITY);
    await this.redis.expire(key, CART_TTL_SECONDS);
    await this.touch(customerId);
  }

  /** Fija la cantidad exacta de un producto; 0 lo quita. */
  async set(customerId: string, productId: string, quantity: number): Promise<void> {
    const key = cartKey(customerId);
    if (quantity <= 0) {
      await this.redis.hdel(key, productId);
      return;
    }
    await this.assertRoomFor(key, productId);
    await this.redis.hset(key, productId, Math.min(quantity, CART_MAX_QUANTITY));
    await this.redis.expire(key, CART_TTL_SECONDS);
    await this.touch(customerId);
  }

  async remove(customerId: string, productIds: readonly string[]): Promise<void> {
    if (productIds.length > 0) await this.redis.hdel(cartKey(customerId), ...productIds);
  }

  async clear(customerId: string): Promise<void> {
    await this.redis.del(cartKey(customerId));
    await this.redis.zrem(CART_ACTIVITY_KEY, customerId);
  }

  /** Descuenta del carrito lo que ya se compró; lo que el cliente agregó después se conserva. */
  async consume(customerId: string, purchased: readonly StockLine[]): Promise<void> {
    const key = cartKey(customerId);
    for (const { productId, quantity } of purchased) {
      const remaining = await this.redis.hincrby(key, productId, -quantity);
      if (remaining <= 0) await this.redis.hdel(key, productId);
    }
  }

  private async touch(customerId: string): Promise<void> {
    await this.redis.zadd(CART_ACTIVITY_KEY, Date.now(), customerId);
  }

  private async assertRoomFor(key: string, productId: string): Promise<void> {
    if (await this.redis.hexists(key, productId)) return;
    if ((await this.redis.hlen(key)) >= CART_MAX_LINES) {
      throw new BadRequestException(`El carrito admite hasta ${CART_MAX_LINES} productos distintos`);
    }
  }
}
