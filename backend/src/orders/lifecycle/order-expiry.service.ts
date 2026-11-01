import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectConfig } from '../../config/config.module';
import { Env } from '../../config/env.validation';
import { RedisService } from '../../redis/redis.service';
import { OrderLifecycleService } from './order-lifecycle.service';

const LOCK_KEY = 'locks:order-expiry';

/**
 * Libera el stock de los pedidos que nadie pagó a tiempo. Con varias instancias del backend, un candado en
 * Redis hace que en cada vuelta trabaje una sola; si una instancia cae, la siguiente toma la posta.
 */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryService.name);
  private readonly instanceId = randomUUID();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly lifecycle: OrderLifecycleService,
    private readonly redis: RedisService,
    @InjectConfig() private readonly config: Env,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runOnce(), this.config.ORDER_EXPIRY_INTERVAL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Una vuelta de limpieza. Devuelve cuántos pedidos liberó (0 si otra instancia ya la estaba haciendo). */
  async runOnce(): Promise<number> {
    const lockMs = Math.max(1000, this.config.ORDER_EXPIRY_INTERVAL_SECONDS * 900);
    try {
      const acquired = await this.redis.set(LOCK_KEY, this.instanceId, 'PX', lockMs, 'NX');
      if (!acquired) return 0;

      const released = await this.lifecycle.expireDue();
      if (released > 0) this.logger.log(`${released} pedido(s) vencido(s): stock liberado`);
      return released;
    } catch (error) {
      this.logger.error(`Falló la liberación de pedidos vencidos: ${(error as Error).message}`);
      return 0;
    }
  }
}
