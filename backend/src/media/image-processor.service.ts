import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { IMAGE_VARIANTS, IMAGE_VARIANT_NAMES, ImageVariant } from './image-variants';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 80;

@Injectable()
export class ImageProcessorService {
  /**
   * Valida el contenido real del archivo (no confía en el mimetype del cliente) y genera las variantes WebP.
   * `rotate()` aplica la orientación EXIF; al reexportar se descartan los metadatos (incluida la ubicación GPS).
   */
  async createVariants(input: Buffer): Promise<Record<ImageVariant, Buffer>> {
    await this.assertSupportedImage(input);

    const entries = await Promise.all(
      IMAGE_VARIANT_NAMES.map(async (name) => {
        const buffer = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
          .rotate()
          .resize({ width: IMAGE_VARIANTS[name], withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        return [name, buffer] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<ImageVariant, Buffer>;
  }

  private async assertSupportedImage(input: Buffer): Promise<void> {
    try {
      const { format } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      if (format && ALLOWED_FORMATS.has(format)) return;
    } catch {
      // se informa abajo con un mensaje único, sin filtrar detalles del decodificador
    }
    throw new BadRequestException('El archivo no es una imagen válida (se aceptan JPEG, PNG o WebP)');
  }
}
