/** Valores fijos de las pruebas de integración: la base y Redis son descartables y se siembran con esto. */
export const ADMIN = { email: 'admin@omnistock.local', password: 'E2e-Admin-Passw0rd!' };
export const DEMO_PASSWORD = 'E2e-Demo-Passw0rd!';
export const STAFF = {
  gerenteCen: 'gerente.cen@omnistock.local',
  salaCen: 'sala.cen@omnistock.local',
  salaNor: 'sala.nor@omnistock.local',
  stockeoCen: 'stockeo.cen@omnistock.local',
  encargadoCen: 'encargado.cen@omnistock.local',
} as const;

export const GOOGLE_CLIENT_ID = 'e2e-client-id.apps.googleusercontent.com';
export const GOOGLE_CLIENT_SECRET = 'e2e-google-client-secret';

export const MP_PORT = Number(process.env.E2E_MP_PORT ?? 4011);
export const MP_URL = `http://127.0.0.1:${MP_PORT}`;
export const MP_TOKEN = 'APP_USR-1234567890123456-102912-aaaabbbbccccddddeeeeffff00001111-777000111';
export const MP_WEBHOOK_SECRET = 'c0ffee'.repeat(10) + 'beef';
