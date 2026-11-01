import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import { IMAGE_VARIANT_NAMES, variantKey } from './image-variants';
import { ImageProcessorService } from './image-processor.service';
import { ImageUrls, MediaUrlService } from './media-url.service';

export interface UploadedImage {
  imageKey: string;
  urls: ImageUrls;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly processor: ImageProcessorService,
    private readonly urls: MediaUrlService,
  ) {}

  async uploadProductImage(file: Buffer): Promise<UploadedImage> {
    const variants = await this.processor.createVariants(file);
    const imageKey = `products/${randomUUID()}`;

    try {
      await Promise.all(
        IMAGE_VARIANT_NAMES.map((name) => this.storage.put(variantKey(imageKey, name), variants[name], 'image/webp')),
      );
    } catch (error) {
      await this.deleteImage(imageKey);
      throw error;
    }
    return { imageKey, urls: this.urls.forKey(imageKey)! };
  }

  deleteImage(imageKey: string): Promise<void> {
    return this.storage.delete(IMAGE_VARIANT_NAMES.map((name) => variantKey(imageKey, name)));
  }
}
