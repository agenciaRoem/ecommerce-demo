import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import Redis from 'ioredis';
import { ADMIN, DEMO_PASSWORD, MP_PORT } from './constants';
import { startMockMercadoPago } from './mock-mercadopago';

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}. Las pruebas de integración necesitan una base y un Redis descartables (ver README).`);
  return value;
};

/** Prepara la base de pruebas (la recrea), aplica las migraciones, la siembra y levanta el Mercado Pago simulado. */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = need('E2E_DATABASE_URL');
  const redisUrl = need('E2E_REDIS_URL');

  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]*test[a-z0-9_]*$/.test(dbName)) throw new Error(`Por seguridad la base de pruebas debe tener "test" en el nombre (es "${dbName}").`);
  const dbIndex = Number(new URL(redisUrl).pathname.slice(1) || 0);
  if (!dbIndex) throw new Error('Por seguridad E2E_REDIS_URL debe apuntar a una base de Redis distinta de la 0 (ej. redis://host:6379/1).');

  url.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    // Siempre desde cero: cada corrida arranca con la misma base y no hereda datos de la anterior.
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SEED_SUPERADMIN_EMAIL: ADMIN.email,
    SEED_SUPERADMIN_PASSWORD: ADMIN.password,
    SEED_DEMO_STAFF_PASSWORD: DEMO_PASSWORD,
    SEED_DEMO_CATALOG: 'false',
  };
  execSync('npx prisma migrate deploy', { env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit' });

  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();

  (globalThis as { __MP__?: Server }).__MP__ = await startMockMercadoPago(MP_PORT);
}
