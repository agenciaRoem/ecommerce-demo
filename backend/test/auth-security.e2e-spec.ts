import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ADMIN, DEMO_PASSWORD, STAFF } from './support/constants';
import { Client, adminClient, createApp, loadFixture, uniq } from './support/harness';

describe('Autenticación y seguridad', () => {
  let app: INestApplication;
  let admin: Client;

  beforeAll(async () => {
    app = await createApp();
    admin = await adminClient(app);
  });
  afterAll(() => app.close());

  /** Alta de un empleado descartable para probar bajas y cambios de rol sin tocar las cuentas sembradas. */
  async function newStaff(role: 'SALA' | 'STOCKEO' | 'GERENTE' = 'SALA') {
    const { cenId } = await loadFixture(app);
    const email = `e2e.${uniq()}@omnistock.local`;
    const password = `Clave-${uniq()}-segura`;
    const res = await admin.post('/backoffice/staff', { email, fullName: 'Empleado E2E', password, role, branchId: cenId });
    expect(res.status).toBe(201);
    return { email, password, id: res.body.id as string };
  }

  describe('login y sesiones', () => {
    it('ingresa con credenciales válidas y devuelve el perfil sin secretos', async () => {
      const client = new Client(app);
      const res = await client.post('/auth/login', { email: STAFF.gerenteCen, password: DEMO_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: STAFF.gerenteCen, role: 'GERENTE' });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
      expect((await client.get('/auth/me')).status).toBe(200);
    });

    it('responde igual a un email inexistente que a una contraseña mala (no revela cuentas)', async () => {
      const wrongPassword = await new Client(app).post('/auth/login', { email: STAFF.gerenteCen, password: 'incorrecta-123' });
      const unknownEmail = await new Client(app).post('/auth/login', { email: `nadie.${uniq()}@omnistock.local`, password: 'incorrecta-123' });
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('sin sesión no se accede a nada protegido', async () => {
      expect((await new Client(app).get('/auth/me')).status).toBe(401);
      expect((await new Client(app).get('/backoffice/prices')).status).toBe(401);
    });

    it('rota el refresh token y detecta su reutilización cerrando todas las sesiones', async () => {
      const client = new Client(app);
      const login = await client.post('/auth/login', { email: STAFF.salaCen, password: DEMO_PASSWORD });
      const stolen = (login.headers['set-cookie'] as unknown as string[]).find((cookie) => cookie.startsWith('refresh_token='))!.split(';')[0];

      expect((await client.post('/auth/refresh')).status).toBe(200); // uso legítimo: rota el token
      const replay = await request(app.getHttpServer()).post('/auth/refresh').set('X-Forwarded-For', client.ip).set('Cookie', stolen);
      expect(replay.status).toBe(401); // el token viejo ya no sirve
      expect((await client.post('/auth/refresh')).status).toBe(401); // y la reutilización cerró también la sesión legítima
    });

    it('logout cierra la sesión', async () => {
      const client = await new Client(app).loginStaff(STAFF.salaNor);
      expect((await client.post('/auth/logout')).status).toBeLessThan(300);
      expect((await client.get('/auth/me')).status).toBe(401);
    });
  });

  describe('la baja es inmediata', () => {
    it('dar de baja corta el acceso ya emitido, la renovación y el ingreso', async () => {
      const staff = await newStaff('SALA');
      const client = await new Client(app).loginStaff(staff.email, staff.password);
      expect((await client.get('/auth/me')).status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1100)); // la revocación se mide en segundos
      expect((await admin.patch(`/backoffice/staff/${staff.id}`, { isActive: false })).status).toBe(200);

      expect((await client.get('/auth/me')).status).toBe(401); // con el MISMO access token, sin esperar a que venza
      expect((await client.post('/auth/refresh')).status).toBe(401);
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: staff.password })).status).toBe(401);
    });

    it('cambiar el rol también invalida el acceso viejo', async () => {
      const staff = await newStaff('SALA');
      const client = await new Client(app).loginStaff(staff.email, staff.password);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect((await admin.patch(`/backoffice/staff/${staff.id}`, { role: 'STOCKEO' })).status).toBe(200);
      expect((await client.get('/auth/me')).status).toBe(401);
    });

    it('restablecer la contraseña cierra las sesiones abiertas', async () => {
      const staff = await newStaff('GERENTE');
      const client = await new Client(app).loginStaff(staff.email, staff.password);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect((await admin.post(`/backoffice/staff/${staff.id}/password`, { password: 'Otra-clave-muy-segura-1' })).status).toBe(204);
      expect((await client.get('/auth/me')).status).toBe(401);
      await expect(new Client(app).loginStaff(staff.email, 'Otra-clave-muy-segura-1')).resolves.toBeDefined();
    });

    it('nadie se da de baja ni se cambia el rol a sí mismo', async () => {
      const me = (await admin.get('/auth/me')).body.id as string;
      expect((await admin.patch(`/backoffice/staff/${me}`, { isActive: false })).status).toBe(400);
      expect((await admin.patch(`/backoffice/staff/${me}`, { role: 'GERENTE' })).status).toBe(400);
    });
  });

  describe('límite de tasa distribuido (Redis)', () => {
    it('frena la fuerza bruta de login desde una misma IP y no afecta a otras', async () => {
      const attacker = new Client(app);
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) statuses.push((await attacker.post('/auth/login', { email: STAFF.gerenteCen, password: `mala-${i}` })).status);
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses.slice(5)).toEqual([429, 429]);

      expect((await new Client(app).post('/auth/login', { email: STAFF.gerenteCen, password: DEMO_PASSWORD })).status).toBe(200); // otra IP
    });

    it('la cuenta bloqueada por la IP sigue bloqueada aunque la contraseña sea la correcta', async () => {
      const attacker = new Client(app);
      for (let i = 0; i < 5; i++) await attacker.post('/auth/login', { email: STAFF.gerenteCen, password: `mala-${i}` });
      expect((await attacker.post('/auth/login', { email: STAFF.gerenteCen, password: DEMO_PASSWORD })).status).toBe(429);
    });
  });

  describe('límite de intentos por cuenta', () => {
    it('bloquea la cuenta tras demasiados fallos aunque vengan de IP distintas, y no revela si existe', async () => {
      const email = `objetivo.${uniq()}@omnistock.local`; // ni siquiera existe: igual se cuenta
      for (let i = 0; i < 10; i++) expect((await new Client(app).post('/auth/login', { email, password: `mala-${i}` })).status).toBe(401);
      const blocked = await new Client(app).post('/auth/login', { email, password: 'otra-mala' });
      expect(blocked.status).toBe(429);
    });

    it('una cuenta real bloqueada no deja entrar ni con la contraseña correcta; otras cuentas no se ven afectadas', async () => {
      const staff = await newStaff('SALA');
      for (let i = 0; i < 10; i++) await new Client(app).post('/auth/login', { email: staff.email, password: `mala-${i}` });
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: staff.password })).status).toBe(429);
      expect((await new Client(app).post('/auth/login', { email: STAFF.gerenteCen, password: DEMO_PASSWORD })).status).toBe(200);
    });

    it('un ingreso correcto borra los fallos acumulados', async () => {
      const staff = await newStaff('SALA');
      for (let i = 0; i < 9; i++) await new Client(app).post('/auth/login', { email: staff.email, password: `mala-${i}` });
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: staff.password })).status).toBe(200);
      for (let i = 0; i < 9; i++) expect((await new Client(app).post('/auth/login', { email: staff.email, password: `mala-${i}` })).status).toBe(401);
    });
  });

  describe('defensas del navegador', () => {
    it('rechaza escrituras que dicen venir de otro sitio (CSRF)', async () => {
      const client = await new Client(app).loginStaff(STAFF.stockeoCen);
      const res = await client.post('/auth/logout', undefined, { Origin: 'https://sitio-malicioso.example' });
      expect(res.status).toBe(403);
      expect((await client.get('/auth/me')).status).toBe(200); // la sesión sigue intacta
    });

    it('acepta escrituras del origen de la tienda', async () => {
      const client = await new Client(app).loginStaff(STAFF.stockeoCen);
      expect((await client.post('/auth/logout', undefined, { Origin: 'http://localhost:3000' })).status).toBeLessThan(300);
    });

    it('CORS solo habilita el origen de la tienda', async () => {
      const allowed = await request(app.getHttpServer()).options('/products').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');
      const denied = await request(app.getHttpServer()).options('/products').set('Origin', 'https://sitio-malicioso.example').set('Access-Control-Request-Method', 'GET');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('las cookies de sesión son HttpOnly y SameSite=Strict', async () => {
      const res = await new Client(app).post('/auth/login', { email: ADMIN.email, password: ADMIN.password });
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.length).toBeGreaterThanOrEqual(2);
      for (const cookie of cookies) {
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Strict/i);
      }
      expect(cookies.find((cookie) => cookie.startsWith('refresh_token='))).toMatch(/Path=\/auth/);
    });

    it('la API manda cabeceras de seguridad y no revela el servidor', async () => {
      const res = await new Client(app).get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    it('un error interno no filtra detalles', async () => {
      const res = await (await new Client(app).loginStaff(STAFF.gerenteCen)).get('/backoffice/audit');
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|stack|node_modules|select /i);
    });
  });
});
