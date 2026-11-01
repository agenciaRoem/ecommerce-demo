import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MP_URL } from './constants';

/** Configuración del backend para las pruebas: se carga antes que cualquier módulo. */
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.E2E_DATABASE_URL,
  REDIS_URL: process.env.E2E_REDIS_URL,
  JWT_ACCESS_SECRET: 'e2e-access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  MERCADOPAGO_API_URL: MP_URL,
  PUBLIC_API_URL: 'http://localhost:4000',
  PUBLIC_STORE_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  COOKIE_SECURE: 'false',
  MAIL_DRIVER: 'memory', // los correos quedan en MailService.outbox y las pruebas leen los enlaces de ahí
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_AUTH_URL: `${MP_URL}/google/auth`,
  GOOGLE_TOKEN_URL: `${MP_URL}/google/token`,
  TRUST_PROXY: '1', // cada cliente de prueba se identifica con su propio X-Forwarded-For
  MEDIA_DIR: mkdtempSync(join(tmpdir(), 'omnistock-e2e-')),
  ORDER_EXPIRY_INTERVAL_SECONDS: '3600', // el vencimiento se prueba a mano
});
