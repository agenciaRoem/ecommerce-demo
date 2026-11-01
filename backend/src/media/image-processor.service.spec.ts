import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

const service = new ImageProcessorService();

const solidPng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

describe('ImageProcessorService', () => {
  it('genera las tres variantes en WebP sin superar el ancho configurado', async () => {
    const variants = await service.createVariants(await solidPng(2000, 1000));

    const widths = await Promise.all(Object.values(variants).map(async (b) => (await sharp(b).metadata()).width));
    expect(widths).toEqual([200, 600, 1200]);
    for (const buffer of Object.values(variants)) {
      expect((await sharp(buffer).metadata()).format).toBe('webp');
    }
  });

  it('no agranda imágenes más chicas que la variante', async () => {
    const variants = await service.createVariants(await solidPng(100, 100));
    expect((await sharp(variants.detail).metadata()).width).toBe(100);
  });

  it('descarta los metadatos EXIF (ubicación GPS)', async () => {
    const withExif = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#fff' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'privado' } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const variants = await service.createVariants(withExif);
    expect((await sharp(variants.card).metadata()).exif).toBeUndefined();
  });

  it('rechaza archivos que no son imágenes aunque el cliente diga lo contrario', async () => {
    await expect(service.createVariants(Buffer.from('<script>alert(1)</script>'))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza formatos no admitidos (GIF)', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } })
      .gif()
      .toBuffer();
    await expect(service.createVariants(gif)).rejects.toThrow(BadRequestException);
  });
});
