import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CustomerPricingService } from './customer-pricing.service';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [MediaModule],
  controllers: [CatalogController],
  providers: [CatalogService, PromotionsService, CustomerPricingService],
  exports: [PromotionsService, CustomerPricingService],
})
export class CatalogModule {}
