import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { originCheck } from './origin-check';

function run(method: string, path: string, origin?: string) {
  const middleware = originCheck(['https://tienda.example']);
  const next = jest.fn();
  middleware({ method, path, headers: origin ? { origin } : {} } as unknown as Request, {} as never, next);
  return next.mock.calls[0][0] as unknown;
}

describe('originCheck', () => {
  it('deja pasar lecturas de cualquier origen', () => {
    expect(run('GET', '/products', 'https://malo.example')).toBeUndefined();
  });

  it('deja pasar escrituras de la tienda o sin Origin (servidor a servidor)', () => {
    expect(run('POST', '/checkout', 'https://tienda.example')).toBeUndefined();
    expect(run('POST', '/checkout')).toBeUndefined();
  });

  it('rechaza escrituras que dicen venir de otro sitio', () => {
    expect(run('POST', '/checkout', 'https://malo.example')).toBeInstanceOf(ForbiddenException);
    expect(run('DELETE', '/cart', 'null')).toBeInstanceOf(ForbiddenException);
  });

  it('exceptúa el webhook de la pasarela', () => {
    expect(run('POST', '/payments/webhooks/mercadopago', 'https://api.mercadopago.com')).toBeUndefined();
  });
});
