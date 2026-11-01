import type { Env } from '../config/env.validation';
import { SecretBox } from './secret-box.service';

const box = (fill: number) => new SecretBox({ SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, fill).toString('base64') } as Env);

describe('SecretBox', () => {
  it('descifra lo que cifró', () => {
    const secret = 'APP_USR-1234567890-abcdef-ñ';
    expect(box(1).decrypt(box(1).encrypt(secret))).toBe(secret);
  });

  it('no deja el secreto a la vista y cifra distinto cada vez', () => {
    const a = box(1).encrypt('APP_USR-secreto');
    const b = box(1).encrypt('APP_USR-secreto');
    expect(a).not.toContain('APP_USR');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
  });

  it('falla con otra clave', () => {
    expect(() => box(2).decrypt(box(1).encrypt('x'))).toThrow();
  });

  it('detecta un valor alterado', () => {
    const [v, iv, tag, data] = box(1).encrypt('contenido').split('.');
    const tampered = [v, iv, tag, Buffer.from('otra-cosa').toString('base64url') + data].join('.');
    expect(() => box(1).decrypt(tampered)).toThrow();
  });

  it('rechaza formatos desconocidos', () => {
    expect(() => box(1).decrypt('v9.a.b.c')).toThrow('formato desconocido');
    expect(() => box(1).decrypt('texto-plano')).toThrow();
  });
});
