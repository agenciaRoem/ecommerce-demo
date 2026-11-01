import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import { CartViewService } from './cart-view.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [CatalogModule, MediaModule],
  controllers: [CartController],
  providers: [CartService, CartViewService],
  exports: [CartService, CartViewService],
})
export class CartModule {}
