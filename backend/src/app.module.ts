import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { RedisService } from './redis/redis.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BackofficeModule } from './backoffice/backoffice.module';
import { CustomerAuthGuard } from './common/guards/customer-auth.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigModule } from './config/config.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { CustomersModule } from './customers/customers.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { FulfillmentModule } from './orders/fulfillment/fulfillment.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    // El límite de tasa vive en Redis: es el mismo para todas las instancias del backend.
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({ throttlers: [{ ttl: 60_000, limit: 100 }], storage: new RedisThrottlerStorage(redis) }),
    }),
    StorageModule,
    CryptoModule,
    MailModule,
    AuditModule,
    AuthModule,
    BackofficeModule,
    CartModule,
    CatalogModule,
    CategoriesModule,
    CustomersModule,
    InventoryModule,
    MediaModule,
    OrdersModule,
    FulfillmentModule,
    PaymentsModule,
    ProductsModule,
    HealthModule,
  ],
  providers: [
    // El orden importa: límite de tasa → autenticación (personal, clientes) → autorización por rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CustomerAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
