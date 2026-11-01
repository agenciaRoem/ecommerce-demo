import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(@InjectConfig() config: Env) {
    super(config.REDIS_URL, { maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
