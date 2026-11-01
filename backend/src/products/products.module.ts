import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { MediaModule } from '../media/media.module';
import { PricingService } from './pricing.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [InventoryModule, MediaModule],
  controllers: [ProductsController],
  providers: [ProductsService, PricingService],
})
export class ProductsModule {}
