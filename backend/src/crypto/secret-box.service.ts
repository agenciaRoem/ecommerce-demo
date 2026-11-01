import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

/**
 * Cifra secretos que viven en la base de datos (credenciales de pasarelas). AES-256-GCM autentica el
 * contenido: un valor alterado o cifrado con otra clave falla al descifrar en vez de devolver basura.
 * Formato: `v1.<iv>.<tag>.<datos>` en base64url (el prefijo permite rotar la clave o el algoritmo más adelante).
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(@InjectConfig() config: Env) {
    this.key = Buffer.from(config.SETTINGS_ENCRYPTION_KEY, 'base64');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, data] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !data) throw new Error('Secreto con formato desconocido');

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }
}
