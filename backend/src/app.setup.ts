import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { originCheck } from './common/middleware/origin-check';
import { Env } from './config/env.validation';

/** Sirve las imágenes del disco local. Las claves llevan UUID, así que el contenido es inmutable y cacheable. */
function mountLocalMedia(app: NestExpressApplication, config: Env) {
  if (config.STORAGE_DRIVER !== 'local') return;
  app.useStaticAssets(config.MEDIA_DIR, {
    prefix: '/media',
    index: false,
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-site'), // las consume el frontend
  });
}

/** Middlewares y cabeceras de seguridad. Lo comparten el servidor real y las pruebas de integración. */
export function configureApp(app: NestExpressApplication, config: Env): void {
  // Detrás de Caddy/Cloudflare, `req.ip` es la del proxy salvo que se declare en cuántos proxies confiar.
  if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);

  // Es una API JSON: nada de lo que devuelve se tiene que poder incrustar ni ejecutar en un navegador.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      strictTransportSecurity: config.COOKIE_SECURE ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  app.use(originCheck(config.CORS_ORIGINS));
  mountLocalMedia(app, config);
  app.enableShutdownHooks();
}
