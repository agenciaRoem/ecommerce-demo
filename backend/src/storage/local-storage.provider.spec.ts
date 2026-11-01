import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageProvider } from './local-storage.provider';

describe('LocalStorageProvider', () => {
  let dir: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'omnistock-'));
    storage = new LocalStorageProvider(dir);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('guarda y elimina archivos creando los directorios necesarios', async () => {
    await storage.put('products/abc/thumb.webp', Buffer.from('datos'));
    expect((await readFile(join(dir, 'products/abc/thumb.webp'))).toString()).toBe('datos');

    await storage.delete(['products/abc/thumb.webp']);
    await expect(stat(join(dir, 'products/abc/thumb.webp'))).rejects.toThrow();
  });

  it('eliminar una clave inexistente no falla', async () => {
    await expect(storage.delete(['no/existe.webp'])).resolves.toBeUndefined();
  });

  it.each(['../fuera.txt', 'products/../../fuera.txt', '/etc/passwd'])('rechaza la clave %s', async (key) => {
    await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow('Clave de almacenamiento inválida');
  });
});
