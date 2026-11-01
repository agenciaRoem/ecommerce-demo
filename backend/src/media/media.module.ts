import { Module } from '@nestjs/common';
import { ImageProcessorService } from './image-processor.service';
import { MediaController } from './media.controller';
import { MediaUrlService } from './media-url.service';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, ImageProcessorService, MediaUrlService],
  exports: [MediaUrlService, MediaService],
})
export class MediaModule {}
