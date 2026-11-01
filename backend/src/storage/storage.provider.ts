/** Contrato que implementa cada proveedor de almacenamiento (disco local, S3, R2, MinIO…). */
export interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
