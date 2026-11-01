import { BadRequestException, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { MediaService } from './media.service';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Recibe la foto (cámara del celular), la valida, la optimiza y devuelve la clave para asociarla a un producto. */
  @Roles('STOCKEO', 'ENCARGADO_STOCK', 'GERENTE')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('images')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Falta el archivo (campo "file")');
    return this.media.uploadProductImage(file.buffer);
  }
}
