import { INestApplication } from '@nestjs/common';
import { GOOGLE_CLIENT_ID, STAFF } from './support/constants';
import {
  Client,
  Fixture,
  adminClient,
  configureGateway,
  createApp,
  createProduct,
  loadFixture,
  mailCount,
  registerCustomer,
  staffClient,
  tokenFrom,
  uniq,
  verifyEmailOf,
  waitForMail,
} from './support/harness';

const NEW_PASSWORD = 'Contraseña-nueva-segura-9';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Verificación de email, recuperación de cuenta e ingreso con Google', () => {
  let app: INestApplication;
  let fx: Fixture;
  let stockeo: Client;

  beforeAll(async () => {
    app = await createApp();
    fx = await loadFixture(app);
    stockeo = await staffClient(app, STAFF.stockeoCen);
    await configureGateway(await adminClient(app));
  });
  afterAll(() => app.close());

  describe('verificación de email', () => {
    it('al registrarse llega un correo con el enlace, y sin verificar no se puede comprar', async () => {
      const customer = await registerCustomer(app, 'RETAIL', { verify: false });
      const mail = await waitForMail(app, customer.email, '/cuenta/verificar');
      expect(mail.subject).toContain('Confirmá tu email');
      expect(mail.text).toContain('http://localhost:3000/cuenta/verificar?token=');
      expect((await customer.client.get('/customers/me')).body.emailVerified).toBe(false);

      const product = await createProduct(stockeo, fx.categoryId, 5);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 1 });
      const blocked = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('email_not_verified');

      await verifyEmailOf(app, customer.email);
      expect((await customer.client.get('/customers/me')).body.emailVerified).toBe(true);
      expect((await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId })).status).toBe(201);
    });

    it('el enlace es de un solo uso y un token inventado no sirve', async () => {
      const customer = await registerCustomer(app, 'RETAIL', { verify: false });
      const token = tokenFrom(await waitForMail(app, customer.email, '/cuenta/verificar'));
      expect((await new Client(app).post('/customers/verify-email', { token })).status).toBe(204);
      expect((await new Client(app).post('/customers/verify-email', { token })).status).toBe(400);
      expect((await new Client(app).post('/customers/verify-email', { token: 'x'.repeat(43) })).status).toBe(400);
      expect((await new Client(app).post('/customers/verify-email', { token: 'corto' })).status).toBe(400);
    });

    it('reenviar manda un enlace nuevo, invalida el anterior, y no se puede usar para llenar de correo', async () => {
      const customer = await registerCustomer(app, 'RETAIL', { verify: false });
      const first = tokenFrom(await waitForMail(app, customer.email, '/cuenta/verificar'));
      const before = mailCount(app, customer.email);

      expect((await customer.client.post('/customers/verify-email/resend')).status).toBe(204);
      await pause(300);
      expect(mailCount(app, customer.email)).toBe(before + 1);
      expect((await customer.client.post('/customers/verify-email/resend')).status).toBe(204); // inmediato: no manda otro
      await pause(300);
      expect(mailCount(app, customer.email)).toBe(before + 1);

      const second = tokenFrom(await waitForMail(app, customer.email, '/cuenta/verificar'));
      expect(second).not.toBe(first);
      expect((await new Client(app).post('/customers/verify-email', { token: first })).status).toBe(400); // el viejo ya no vale
      expect((await new Client(app).post('/customers/verify-email', { token: second })).status).toBe(204);
    });

    it('reenviar exige haber ingresado, y una cuenta ya verificada no recibe correos', async () => {
      expect((await new Client(app).post('/customers/verify-email/resend')).status).toBe(401);
      const customer = await registerCustomer(app);
      const before = mailCount(app, customer.email);
      expect((await customer.client.post('/customers/verify-email/resend')).status).toBe(204);
      await pause(300);
      expect(mailCount(app, customer.email)).toBe(before);
    });
  });

  describe('recuperar la contraseña (clientes)', () => {
    it('un email sin cuenta recibe la misma respuesta y ningún correo (no se revela quién tiene cuenta)', async () => {
      const email = `fantasma.${uniq()}@e2e.test`;
      const res = await new Client(app).post('/customers/password/forgot', { email });
      expect(res.status).toBe(204);
      await pause(300);
      expect(mailCount(app, email)).toBe(0);
    });

    it('el flujo completo: pedir, usar el enlace, entrar con la clave nueva y no con la vieja', async () => {
      const customer = await registerCustomer(app);
      expect((await new Client(app).post('/customers/password/forgot', { email: customer.email })).status).toBe(204);
      const mail = await waitForMail(app, customer.email, '/cuenta/restablecer');
      expect(mail.text).toContain('http://localhost:3000/cuenta/restablecer?token=');
      const token = tokenFrom(mail);

      expect((await new Client(app).post('/customers/password/reset', { token, password: NEW_PASSWORD })).status).toBe(204);
      await waitForMail(app, customer.email, 'Cambió la contraseña');
      await pause(1100); // la revocación de sesiones se mide en segundos

      expect((await new Client(app).post('/customers/auth/login', { email: customer.email, password: 'clave-segura-123' })).status).toBe(401);
      expect((await new Client(app).post('/customers/auth/login', { email: customer.email, password: NEW_PASSWORD })).status).toBe(200);
    });

    it('cambiar la contraseña cierra las sesiones abiertas, también el acceso ya emitido', async () => {
      const customer = await registerCustomer(app);
      expect((await customer.client.get('/customers/me')).status).toBe(200);
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      const token = tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'));
      await new Client(app).post('/customers/password/reset', { token, password: NEW_PASSWORD });
      expect((await customer.client.get('/customers/me')).status).toBe(401);
      expect((await customer.client.post('/customers/auth/refresh')).status).toBe(401);
    });

    it('una pestaña vieja que intenta renovar su sesión tras el cambio NO cierra la sesión nueva', async () => {
      const customer = await registerCustomer(app);
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      await new Client(app).post('/customers/password/reset', { token: tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer')), password: NEW_PASSWORD });
      await pause(1100);

      const freshSession = new Client(app);
      expect((await freshSession.post('/customers/auth/login', { email: customer.email, password: NEW_PASSWORD })).status).toBe(200);

      expect((await customer.client.post('/customers/auth/refresh')).status).toBe(401); // la sesión vieja ya no renueva
      expect((await freshSession.get('/customers/me')).status).toBe(200); // pero la nueva sigue en pie
    });

    it('el enlace se usa una sola vez y uno nuevo invalida el anterior', async () => {
      const customer = await registerCustomer(app);
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      const first = tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'));
      await pause(100);
      // Dentro del minuto de espera no se manda otro correo: el primer enlace sigue siendo el vigente.
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      await pause(300);
      expect(tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'))).toBe(first);

      expect((await new Client(app).post('/customers/password/reset', { token: first, password: NEW_PASSWORD })).status).toBe(204);
      expect((await new Client(app).post('/customers/password/reset', { token: first, password: 'Otra-contraseña-9999' })).status).toBe(400);
    });

    it('rechaza contraseñas débiles sin gastar el enlace', async () => {
      const customer = await registerCustomer(app);
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      const token = tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'));
      expect((await new Client(app).post('/customers/password/reset', { token, password: 'corta' })).status).toBe(400);
      expect((await new Client(app).post('/customers/password/reset', { token, password: NEW_PASSWORD })).status).toBe(204); // el enlace seguía vivo
    });

    it('un enlace de clientes no sirve para restablecer una cuenta del personal, ni al revés', async () => {
      const customer = await registerCustomer(app);
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      const token = tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'));
      expect((await new Client(app).post('/auth/password/reset', { token, password: NEW_PASSWORD })).status).toBe(400);
      // Un enlace usado en el lugar equivocado queda gastado: hay que pedir otro (nadie puede probar enlaces en otro panel).
      expect((await new Client(app).post('/customers/password/reset', { token, password: NEW_PASSWORD })).status).toBe(400);
    });

    it('restablecer también confirma el email (llegar con el enlace prueba que es suyo) y limpia los fallos de ingreso', async () => {
      const customer = await registerCustomer(app, 'RETAIL', { verify: false });
      for (let i = 0; i < 10; i++) await new Client(app).post('/customers/auth/login', { email: customer.email, password: `mala-${i}` });
      expect((await new Client(app).post('/customers/auth/login', { email: customer.email, password: 'clave-segura-123' })).status).toBe(429);

      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      const token = tokenFrom(await waitForMail(app, customer.email, '/cuenta/restablecer'));
      await new Client(app).post('/customers/password/reset', { token, password: NEW_PASSWORD });
      await pause(1100);

      const login = await new Client(app).post('/customers/auth/login', { email: customer.email, password: NEW_PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.emailVerified).toBe(true);
    });

    it('una cuenta dada de baja no recibe el correo', async () => {
      const customer = await registerCustomer(app);
      await fx.prisma.customer.update({ where: { id: customer.id }, data: { isActive: false } });
      await new Client(app).post('/customers/password/forgot', { email: customer.email });
      await pause(300);
      expect(mailCount(app, customer.email)).toBe(1); // solo el de verificación del registro
    });

    it('pedir demasiados restablecimientos desde una IP se frena', async () => {
      const client = new Client(app);
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) statuses.push((await client.post('/customers/password/forgot', { email: `x${i}.${uniq()}@e2e.test` })).status);
      expect(statuses.slice(0, 5)).toEqual([204, 204, 204, 204, 204]);
      expect(statuses.slice(5)).toEqual([429, 429]);
    });
  });

  describe('recuperar la contraseña (personal)', () => {
    async function newStaff() {
      const admin = await adminClient(app);
      const email = `recupera.${uniq()}@omnistock.local`;
      const password = `Clave-${uniq()}-segura`;
      const res = await admin.post('/backoffice/staff', { email, fullName: 'Persona Recupera', password, role: 'GERENTE', branchId: fx.cenId });
      expect(res.status).toBe(201);
      return { admin, email, password, id: res.body.id as string };
    }

    it('el personal recupera su cuenta por email con un enlace propio del panel', async () => {
      const staff = await newStaff();
      const session = await new Client(app).loginStaff(staff.email, staff.password);

      expect((await new Client(app).post('/auth/password/forgot', { email: staff.email })).status).toBe(204);
      const mail = await waitForMail(app, staff.email, '/recuperar/restablecer');
      expect(mail.text).toContain('http://localhost:3000/recuperar/restablecer?token=');
      expect((await new Client(app).post('/auth/password/reset', { token: tokenFrom(mail), password: NEW_PASSWORD })).status).toBe(204);

      expect((await session.get('/auth/me')).status).toBe(401); // la sesión anterior se cerró
      await pause(1100);
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: staff.password })).status).toBe(401);
      await expect(new Client(app).loginStaff(staff.email, NEW_PASSWORD)).resolves.toBeDefined();
    });

    it('quien fue dado de baja no recibe el correo, y un email desconocido responde igual', async () => {
      const staff = await newStaff();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await staff.admin.patch(`/backoffice/staff/${staff.id}`, { isActive: false });
      expect((await new Client(app).post('/auth/password/forgot', { email: staff.email })).status).toBe(204);
      expect((await new Client(app).post('/auth/password/forgot', { email: `nadie.${uniq()}@omnistock.local` })).status).toBe(204);
      await pause(300);
      expect(mailCount(app, staff.email)).toBe(0);
    });

    it('recuperar la contraseña no saltea el límite por cuenta: se levanta al restablecer', async () => {
      const staff = await newStaff();
      for (let i = 0; i < 10; i++) await new Client(app).post('/auth/login', { email: staff.email, password: `mala-${i}` });
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: staff.password })).status).toBe(429);
      await new Client(app).post('/auth/password/forgot', { email: staff.email });
      await new Client(app).post('/auth/password/reset', { token: tokenFrom(await waitForMail(app, staff.email, '/recuperar/restablecer')), password: NEW_PASSWORD });
      await pause(1100);
      expect((await new Client(app).post('/auth/login', { email: staff.email, password: NEW_PASSWORD })).status).toBe(200);
    });
  });

  describe('ingreso con Google', () => {
    const challengeOf = (location: string) => new URL(location).searchParams.get('code_challenge')!;

    /** Recorre el ingreso como lo haría el navegador: inicia, "Google" devuelve un código con el perfil, vuelve al callback. */
    async function googleLogin(
      profile: { email: string; name?: string; email_verified?: boolean | string },
      options: { client?: Client; returnTo?: string; tamper?: (claims: Record<string, unknown>) => Record<string, unknown>; state?: (state: string) => string } = {},
    ) {
      const client = options.client ?? new Client(app);
      const start = await client.get(`/customers/auth/google${options.returnTo ? `?returnTo=${encodeURIComponent(options.returnTo)}` : ''}`);
      expect(start.status).toBe(302);
      const location = start.headers.location as string;
      const params = new URL(location).searchParams;
      let claims: Record<string, unknown> = { email_verified: true, ...profile, nonce: params.get('nonce'), code_challenge: challengeOf(location) };
      if (options.tamper) claims = options.tamper(claims);
      const code = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const state = options.state ? options.state(params.get('state')!) : params.get('state')!;
      const callback = await client.get(`/customers/auth/google/callback?code=${code}&state=${state}`);
      return { client, start, location, callback };
    }

    it('informa si Google está habilitado', async () => {
      expect((await new Client(app).get('/customers/auth/providers')).body).toEqual({ google: true });
    });

    it('arma el pedido a Google con PKCE, state y nonce, y ata el ingreso al navegador con una cookie', async () => {
      const start = await new Client(app).get('/customers/auth/google');
      const url = new URL(start.headers.location as string);
      expect(url.searchParams.get('client_id')).toBe(GOOGLE_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/customers/auth/google/callback');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      for (const key of ['state', 'nonce', 'code_challenge']) expect(url.searchParams.get(key)!.length).toBeGreaterThan(20);
      const cookie = (start.headers['set-cookie'] as unknown as string[]).find((value) => value.startsWith('oauth_state='))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toContain(`oauth_state=${url.searchParams.get('state')}`);
    });

    it('una persona nueva entra: se crea su cuenta de particular, ya verificada, y queda con sesión', async () => {
      const email = `nueva.${uniq()}@gmail.test`;
      const { client, callback } = await googleLogin({ email, name: 'Lucía Pérez' }, { returnTo: '/carrito' });
      expect(callback.status).toBe(302);
      expect(callback.headers.location).toBe('http://localhost:3000/cuenta/continuar?next=%2Fcarrito');

      const me = await client.get('/customers/me');
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ email, fullName: 'Lucía Pérez', type: 'RETAIL', emailVerified: true });
      const stored = await fx.prisma.customer.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).toBeTruthy(); // hash de una clave aleatoria, no vacío
    });

    it('puede comprar sin pasos extra (el email ya está verificado por Google)', async () => {
      const email = `compra.${uniq()}@gmail.test`;
      const { client } = await googleLogin({ email, name: 'Compradora' });
      const product = await createProduct(stockeo, fx.categoryId, 5);
      await client.post('/cart/items', { productId: product.id, quantity: 1 });
      expect((await client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId })).status).toBe(201);
    });

    it('una cuenta que ya existía entra a esa cuenta (no se duplica) y queda verificada', async () => {
      const customer = await registerCustomer(app, 'COMMERCE', { verify: false });
      const before = await fx.prisma.customer.count();
      const { client, callback } = await googleLogin({ email: customer.email, name: 'Otro Nombre' });
      expect(callback.headers.location).toBe('http://localhost:3000/cuenta/continuar?next=%2Fcuenta');
      expect(await fx.prisma.customer.count()).toBe(before);
      const me = await client.get('/customers/me');
      expect(me.body).toMatchObject({ id: customer.id, type: 'COMMERCE', emailVerified: true });
      expect(me.body.fullName).not.toBe('Otro Nombre'); // no pisa los datos de la cuenta
    });

    it('quien entró con Google puede definir una contraseña con "Olvidé mi contraseña"', async () => {
      const email = `sinclave.${uniq()}@gmail.test`;
      await googleLogin({ email, name: 'Sin Clave' });
      await new Client(app).post('/customers/password/forgot', { email });
      await new Client(app).post('/customers/password/reset', { token: tokenFrom(await waitForMail(app, email, '/cuenta/restablecer')), password: NEW_PASSWORD });
      await pause(1100);
      expect((await new Client(app).post('/customers/auth/login', { email, password: NEW_PASSWORD })).status).toBe(200);
    });

    it('una cuenta dada de baja no entra por Google', async () => {
      const customer = await registerCustomer(app);
      await fx.prisma.customer.update({ where: { id: customer.id }, data: { isActive: false } });
      const { client, callback } = await googleLogin({ email: customer.email });
      expect(callback.headers.location).toContain('/cuenta/ingresar?error=google');
      expect((await client.get('/customers/me')).status).toBe(401);
    });

    describe('rechaza todo lo que no sea un ingreso legítimo (siempre vuelve al ingreso con un aviso genérico y sin sesión)', () => {
      const email = () => `ataque.${uniq()}@gmail.test`;
      const rejected = async (run: Promise<{ client: Client; callback: { status: number; headers: Record<string, unknown> } }>, who: string) => {
        const { client, callback } = await run;
        expect(callback.status).toBe(302);
        expect(String(callback.headers.location)).toBe('http://localhost:3000/cuenta/ingresar?error=google');
        expect((await client.get('/customers/me')).status).toBe(401);
        expect(await fx.prisma.customer.count({ where: { email: who } })).toBe(0);
      };

      it('email que Google no verificó', async () => {
        const who = email();
        await rejected(googleLogin({ email: who, email_verified: false }), who);
        await rejected(googleLogin({ email: who, email_verified: 'false' }), who);
      });

      it('token para otra aplicación (aud) o de otro emisor (iss)', async () => {
        const who = email();
        await rejected(googleLogin({ email: who }, { tamper: (claims) => ({ ...claims, aud: 'otra-app.apps.googleusercontent.com' }) }), who);
        await rejected(googleLogin({ email: who }, { tamper: (claims) => ({ ...claims, iss: 'https://sitio-falso.example' }) }), who);
      });

      it('token vencido o con nonce ajeno (repetición)', async () => {
        const who = email();
        await rejected(googleLogin({ email: who }, { tamper: (claims) => ({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }) }), who);
        await rejected(googleLogin({ email: who }, { tamper: (claims) => ({ ...claims, nonce: 'otro-nonce' }) }), who);
      });

      it('PKCE: un código emitido para otro desafío no se acepta', async () => {
        const who = email();
        await rejected(googleLogin({ email: who }, { tamper: (claims) => ({ ...claims, code_challenge: 'desafio-de-otro' }) }), who);
      });

      it('state que no corresponde al navegador (CSRF de ingreso)', async () => {
        const who = email();
        await rejected(googleLogin({ email: who }, { state: () => 'a'.repeat(32) }), who);
      });

      it('callback sin la cookie del navegador que inició el ingreso', async () => {
        const who = email();
        const start = await new Client(app).get('/customers/auth/google');
        const params = new URL(start.headers.location as string).searchParams;
        const code = Buffer.from(JSON.stringify({ email: who, email_verified: true, nonce: params.get('nonce'), code_challenge: challengeOf(start.headers.location as string) })).toString('base64url');
        // Otro navegador (sin la cookie `oauth_state`) intenta completar un ingreso que no inició.
        const other = new Client(app);
        const callback = await other.get(`/customers/auth/google/callback?code=${code}&state=${params.get('state')}`);
        expect(String(callback.headers.location)).toContain('error=google');
        expect((await other.get('/customers/me')).status).toBe(401);
        expect(await fx.prisma.customer.count({ where: { email: who } })).toBe(0);
      });

      it('un mismo ingreso no se puede repetir', async () => {
        const who = email();
        const first = await googleLogin({ email: who });
        expect(String(first.callback.headers.location)).not.toContain('error');
        const params = new URL(first.location).searchParams;
        const code = Buffer.from(JSON.stringify({ email: who, email_verified: true, nonce: params.get('nonce'), code_challenge: challengeOf(first.location) })).toString('base64url');
        const replay = await first.client.get(`/customers/auth/google/callback?code=${code}&state=${params.get('state')}`);
        expect(String(replay.headers.location)).toContain('error=google');
      });

      it('Google responde con error o sin datos', async () => {
        const client = new Client(app);
        await client.get('/customers/auth/google');
        expect(String((await client.get('/customers/auth/google/callback?error=access_denied')).headers.location)).toContain('error=google');
        expect(String((await client.get('/customers/auth/google/callback')).headers.location)).toContain('error=google');
      });
    });

    it('no admite redirecciones abiertas: returnTo solo acepta rutas internas', async () => {
      for (const returnTo of ['https://sitio-malicioso.example', '//sitio-malicioso.example', '/\\sitio-malicioso.example', 'javascript:alert(1)']) {
        const { callback } = await googleLogin({ email: `redir.${uniq()}@gmail.test` }, { returnTo });
        expect(callback.headers.location).toBe('http://localhost:3000/cuenta/continuar?next=%2Fcuenta');
      }
    });
  });
});
