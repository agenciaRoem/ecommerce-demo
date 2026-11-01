import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa en profundidad contra CSRF, además de las cookies SameSite=Strict y de CORS: una petición que cambia
 * datos y declara venir de un sitio que no es la tienda se rechaza. Los avisos de la pasarela de pagos no
 * llevan `Origin` (los manda un servidor), por eso se exceptúan por ruta: se autentican con su firma.
 */
export function originCheck(allowedOrigins: readonly string[], exemptPrefixes: readonly string[] = ['/payments/webhooks']) {
  const allowed = new Set(allowedOrigins);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || !origin || allowed.has(origin) || exemptPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      next();
      return;
    }
    next(new ForbiddenException('Origen no permitido'));
  };
}
