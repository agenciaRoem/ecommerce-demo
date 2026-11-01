import { Module } from '@nestjs/common';
import { InventoryModule } from '../../inventory/inventory.module';
import { OrderExpiryService } from './order-expiry.service';
import { OrderLifecycleService } from './order-lifecycle.service';

/** Estados del pedido y su efecto en el stock. No depende de pagos ni de la tienda: ambos dependen de él. */
@Module({
  imports: [InventoryModule],
  providers: [OrderLifecycleService, OrderExpiryService],
  exports: [OrderLifecycleService],
})
export class OrderLifecycleModule {}
