import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockReservationService } from './stock-reservation.service';

@Module({
  imports: [MediaModule],
  controllers: [InventoryController],
  providers: [InventoryService, StockReservationService],
  exports: [InventoryService, StockReservationService],
})
export class InventoryModule {}
