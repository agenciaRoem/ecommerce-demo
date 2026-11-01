import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { StorageProvider } from './storage.provider';

export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.pathFor(key), { force: true })));
  }

  /** Resuelve la clave dentro de la raíz; cualquier intento de salir de ella (`../`) se rechaza. */
  private pathFor(key: string): string {
    const target = resolve(this.root, key);
    if (!target.startsWith(this.root + sep)) {
      throw new Error('Clave de almacenamiento inválida');
    }
    return target;
  }
}
