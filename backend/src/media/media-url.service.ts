import { Injectable } from '@nestjs/common';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { IMAGE_VARIANT_NAMES, ImageVariant, variantKey } from './image-variants';

export type ImageUrls = Record<ImageVariant, string>;

/** Traduce claves de almacenamiento a URLs públicas. Es lo único que cambia si se migra de proveedor/CDN. */
@Injectable()
export class MediaUrlService {
  constructor(@InjectConfig() private readonly config: Env) {}

  forKey(imageKey: string | null): ImageUrls | null {
    if (!imageKey) return null;
    const entries = IMAGE_VARIANT_NAMES.map(
      (name) => [name, `${this.config.MEDIA_PUBLIC_URL}/${variantKey(imageKey, name)}`] as const,
    );
    return Object.fromEntries(entries) as ImageUrls;
  }
}
