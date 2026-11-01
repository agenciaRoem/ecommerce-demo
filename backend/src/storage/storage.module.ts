import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import { Env } from '../config/env.validation';
import { LocalStorageProvider } from './local-storage.provider';
import { STORAGE_PROVIDER, StorageProvider } from './storage.provider';

/** Punto único donde se elige el proveedor según `STORAGE_DRIVER`. */
export function createStorageProvider(config: Env): StorageProvider {
  switch (config.STORAGE_DRIVER) {
    case 'local':
      return new LocalStorageProvider(config.MEDIA_DIR);
  }
}

@Global()
@Module({
  providers: [{ provide: STORAGE_PROVIDER, useFactory: createStorageProvider, inject: [APP_CONFIG] }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
