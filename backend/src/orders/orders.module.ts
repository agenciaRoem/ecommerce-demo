import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MediaModule } from '../media/media.module';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutService } from './checkout.service';
import { OrderLifecycleModule } from './lifecycle/order-lifecycle.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, CatalogModule, InventoryModule, MediaModule, OrderLifecycleModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [CheckoutService, OrdersService],
})
export class OrdersModule {}
