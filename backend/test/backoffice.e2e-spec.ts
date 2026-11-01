import { INestApplication } from '@nestjs/common';
import { RedisService } from '../src/redis/redis.service';
import { STAFF } from './support/constants';
import {
  Client,
  Fixture,
  adminClient,
  buyAndPay,
  configureGateway,
  createApp,
  createProduct,
  loadFixture,
  mock,
  registerCustomer,
  staffClient,
  uniq,
} from './support/harness';

describe('Backoffice de gerencia y administración', () => {
  let app: INestApplication;
  let fx: Fixture;
  let admin: Client;
  let gerente: Client;
  let stockeo: Client;

  beforeAll(async () => {
    app = await createApp();
    fx = await loadFixture(app);
    admin = await adminClient(app);
    gerente = await staffClient(app, STAFF.gerenteCen);
    stockeo = await staffClient(app, STAFF.stockeoCen);
    await configureGateway(admin);
  });
  beforeEach(() => mock.reset());
  afterAll(() => app.close());

  describe('métricas', () => {
    it('suma las ventas pagadas de la sucursal y no las de otra', async () => {
      const before = (await gerente.get('/backoffice/analytics/overview')).body;
      const beforeNor = (await admin.get(`/backoffice/analytics/overview?branchId=${fx.norId}`)).body;

      const product = await createProduct(stockeo, fx.categoryId, 20);
      const sale = await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId, quantity: 3 });

      const after = (await gerente.get('/backoffice/analytics/overview')).body;
      expect(after.totals.orders - before.totals.orders).toBe(1);
      expect(after.totals.units - before.totals.units).toBe(3);
      expect(Number(after.totals.revenue) - Number(before.totals.revenue)).toBeCloseTo(sale.total, 2);
      expect(after.topProducts.some((row: { productId: string }) => row.productId === product.id)).toBe(true);
      expect(after.byBranch).toBeNull(); // el gerente ve solo su sucursal

      const afterNor = (await admin.get(`/backoffice/analytics/overview?branchId=${fx.norId}`)).body;
      expect(afterNor.totals.orders).toBe(beforeNor.totals.orders);
      expect((await admin.get('/backoffice/analytics/overview')).body.byBranch.length).toBeGreaterThanOrEqual(1);
    });

    it.each(['?from=2026-11-10&to=2026-11-01', '?to=2099-01-01', '?from=2020-01-01', '?from=2026-02-31', '?from=ayer'])('rechaza el rango inválido %s', async (query) => {
      expect((await gerente.get(`/backoffice/analytics/overview${query}`)).status).toBe(400);
    });

    it('la serie diaria viene completa, con ceros en los días sin ventas', async () => {
      const { series, range } = (await gerente.get('/backoffice/analytics/overview?from=2020-03-01&to=2020-03-07')).body;
      expect(range.days).toBe(7);
      expect(series).toHaveLength(7);
      expect(series.every((point: { orders: number }) => point.orders === 0)).toBe(true);
    });

    it('lista el stock bajo de la sucursal del gerente', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 2);
      const low = await gerente.get('/backoffice/analytics/low-stock?threshold=5');
      expect(low.body.some((row: { product: { id: string } }) => row.product.id === product.id)).toBe(true);
      expect(low.body.every((row: { branch: { id: string } }) => row.branch.id === fx.cenId)).toBe(true);
    });
  });

  describe('carritos abandonados', () => {
    it('aparece el carrito inactivo con sus productos y desaparece al vaciarse', async () => {
      const redis = app.get(RedisService);
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 3 });

      const fresh = await gerente.get('/backoffice/abandoned-carts?idleMinutes=60');
      expect(fresh.body.items.some((cart: { customer: { id: string } }) => cart.customer.id === customer.id)).toBe(false);

      await redis.zadd('carts:activity', Date.now() - 3 * 3_600_000, customer.id);
      const stale = await gerente.get('/backoffice/abandoned-carts?idleMinutes=60');
      const cart = stale.body.items.find((item: { customer: { id: string } }) => item.customer.id === customer.id);
      expect(cart).toMatchObject({ units: 3, lines: [{ name: product.name, quantity: 3 }] });
      expect(JSON.stringify(stale.body)).not.toMatch(/argon|passwordHash/);

      await customer.client.delete('/cart');
      await redis.zadd('carts:activity', Date.now() - 3 * 3_600_000, customer.id);
      const emptied = await gerente.get('/backoffice/abandoned-carts?idleMinutes=60');
      expect(emptied.body.items.some((item: { customer: { id: string } }) => item.customer.id === customer.id)).toBe(false);
    });
  });

  describe('promociones', () => {
    const window = () => ({ startsAt: new Date(Date.now() - 86_400_000).toISOString(), endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString() });

    it('el gerente maneja las de su sucursal, no las de otra ni las globales', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const base = { name: `Promo ${uniq()}`, discountType: 'PERCENTAGE', value: 10, scope: 'PRODUCTS', productIds: [product.id], ...window() };

      const own = await gerente.post('/backoffice/promotions', base);
      expect(own.status).toBe(201);
      expect(own.body).toMatchObject({ state: 'active', branch: { id: fx.cenId } });
      expect((await gerente.post('/backoffice/promotions', { ...base, branchId: fx.norId })).status).toBe(403);
      expect((await gerente.post('/backoffice/promotions', { ...base, branchId: null })).status).toBe(403);

      const global = await admin.post('/backoffice/promotions', { ...base, name: `Global ${uniq()}`, value: 5 });
      expect(global.body.branch).toBeNull();
      const other = await admin.post('/backoffice/promotions', { ...base, name: `Norte ${uniq()}`, branchId: fx.norId });

      const visible = (await gerente.get('/backoffice/promotions?status=active')).body.items.map((promotion: { id: string }) => promotion.id);
      expect(visible).toContain(own.body.id);
      expect(visible).toContain(global.body.id);
      expect(visible).not.toContain(other.body.id);

      expect((await gerente.put(`/backoffice/promotions/${global.body.id}`, base)).status).toBe(404);
      expect((await gerente.put(`/backoffice/promotions/${other.body.id}`, base)).status).toBe(404);
      expect((await gerente.put(`/backoffice/promotions/${own.body.id}`, { ...base, isActive: false })).body.state).toBe('inactive');
    });

    it.each([
      ['termina antes de empezar', { endsAt: new Date(Date.now() - 5 * 86_400_000).toISOString() }],
      ['más de 100%', { value: 150 }],
      ['categoría sin categoryId', { scope: 'CATEGORY', productIds: undefined }],
      ['productos sin productIds', { scope: 'PRODUCTS', productIds: [] }],
      ['nombre con carácter de control', { name: `a${String.fromCharCode(0)}b` }],
    ])('valida: %s', async (_label, patch) => {
      const body = { name: 'Promo inválida', discountType: 'PERCENTAGE', value: 10, scope: 'ALL', ...window(), ...patch };
      expect((await gerente.post('/backoffice/promotions', body)).status).toBe(400);
    });

    it('el catálogo público aplica la promoción vigente y deja de hacerlo si se pausa', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const name = `Evento ${uniq()}`;
      const promo = await gerente.post('/backoffice/promotions', { name, discountType: 'PERCENTAGE', value: 20, scope: 'PRODUCTS', productIds: [product.id], ...window() });

      const anon = new Client(app);
      expect((await anon.get(`/catalog/products/${product.id}?branchId=${fx.cenId}`)).body.price.promotion?.name).toBe(name);

      await gerente.put(`/backoffice/promotions/${promo.body.id}`, { name, discountType: 'PERCENTAGE', value: 20, scope: 'PRODUCTS', productIds: [product.id], isActive: false, ...window() });
      expect((await anon.get(`/catalog/products/${product.id}?branchId=${fx.cenId}`)).body.price.promotion).toBeNull();
    });
  });

  describe('sucursales', () => {
    it('alta con sigla en mayúsculas, sin repetidos, y baja con las reglas de seguridad', async () => {
      const code = `T${uniq().slice(0, 4)}`.toUpperCase();
      const name = `Sucursal ${uniq()}`;
      const created = await admin.post('/backoffice/branches', { name, code: code.toLowerCase(), address: 'Calle Falsa 123' });
      expect(created.status).toBe(201);
      expect(created.body.code).toBe(code);
      expect((await admin.post('/backoffice/branches', { name: `Otra ${uniq()}`, code, address: 'Calle Falsa 456' })).status).toBe(409);
      expect((await admin.post('/backoffice/branches', { name, code: 'ZZ9', address: 'Calle Falsa 456' })).status).toBe(409);
      expect((await admin.post('/backoffice/branches', { name: `Mala ${uniq()}`, code: 'a b!', address: 'Calle Falsa 456' })).status).toBe(400);
      expect((await gerente.post('/backoffice/branches', { name: `G ${uniq()}`, code: 'GG1', address: 'Calle Falsa 456' })).status).toBe(403);

      expect((await new Client(app).get('/catalog/branches')).body.some((branch: { code: string }) => branch.code === code)).toBe(true);
      expect((await admin.patch(`/backoffice/branches/${created.body.id}`, { isActive: false })).body.isActive).toBe(false);
      expect((await new Client(app).get('/catalog/branches')).body.some((branch: { code: string }) => branch.code === code)).toBe(false);
    });

    it('no se da de baja una sucursal con pedidos sin terminar', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId });
      const res = await admin.patch(`/backoffice/branches/${fx.cenId}`, { isActive: false });
      expect(res.status).toBe(409);
      expect((await fx.prisma.branch.findUniqueOrThrow({ where: { id: fx.cenId } })).isActive).toBe(true);
    });
  });

  describe('personal', () => {
    it('cada rol de sucursal exige sucursal; el superadmin no lleva; no hay emails repetidos ni contraseñas débiles', async () => {
      const email = `p.${uniq()}@omnistock.local`;
      const base = { email, fullName: 'Persona E2E', password: 'Clave-muy-segura-1' };
      expect((await admin.post('/backoffice/staff', { ...base, role: 'ENCARGADO_STOCK' })).status).toBe(400);
      expect((await admin.post('/backoffice/staff', { ...base, role: 'SUPERADMIN', branchId: fx.cenId })).status).toBe(400);
      expect((await admin.post('/backoffice/staff', { ...base, role: 'SALA', branchId: fx.cenId, password: 'corta' })).status).toBe(400);
      const ok = await admin.post('/backoffice/staff', { ...base, role: 'ENCARGADO_STOCK', branchId: fx.cenId });
      expect(ok.status).toBe(201);
      expect(JSON.stringify(ok.body)).not.toMatch(/password|argon/i);
      expect((await admin.post('/backoffice/staff', { ...base, role: 'SALA', branchId: fx.cenId })).status).toBe(409);
      expect((await gerente.post('/backoffice/staff', { ...base, email: `q.${uniq()}@omnistock.local`, role: 'SALA', branchId: fx.cenId })).status).toBe(403);
    });
  });

  describe('aprobación de CUIT y pagos a revisar', () => {
    it('un comercio compra a precio minorista hasta que se aprueba su CUIT, y todo queda auditado', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const commerce = await registerCustomer(app, 'COMMERCE');

      const pending = await admin.get(`/backoffice/commerce-customers?status=pending&search=${commerce.email.split('@')[0].slice(-8)}`);
      expect(pending.body.items.some((row: { id: string }) => row.id === commerce.id)).toBe(true);
      expect((await admin.post(`/backoffice/commerce-customers/${commerce.id}/cuit-verification`, { verified: true })).status).toBe(400); // exige nota
      expect((await gerente.post(`/backoffice/commerce-customers/${commerce.id}/cuit-verification`, { verified: true, note: 'prueba' })).status).toBe(403);

      const retailPrice = (await commerce.client.get(`/catalog/products/${product.id}`)).body.price.price;
      expect((await admin.post(`/backoffice/commerce-customers/${commerce.id}/cuit-verification`, { verified: true, note: 'Constancia de ARCA' })).status).toBe(200);
      await commerce.client.post('/customers/auth/refresh'); // renueva la sesión con el nuevo estado
      const wholesale = (await commerce.client.get(`/catalog/products/${product.id}`)).body.price.price;
      expect(Number(wholesale)).toBeLessThan(Number(retailPrice));

      const retail = await registerCustomer(app, 'RETAIL');
      expect((await admin.post(`/backoffice/commerce-customers/${retail.id}/cuit-verification`, { verified: true, note: 'prueba' })).status).toBe(400);

      const audit = await admin.get('/backoffice/audit?action=customer.cuit_verified');
      const entry = audit.body.items.find((row: { entityId: string }) => row.entityId === commerce.id);
      expect(entry).toMatchObject({ actor: { email: 'admin@omnistock.local' }, metadata: { note: 'Constancia de ARCA' } });
    });

    it('un aviso de pago se resuelve una sola vez y queda en la auditoría', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const { orderId } = await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId });
      await fx.prisma.order.update({ where: { id: orderId }, data: { paymentIssue: 'Importe distinto (e2e)' } });

      expect((await admin.get('/backoffice/payment-issues')).body.some((row: { id: string }) => row.id === orderId)).toBe(true);
      expect((await admin.post(`/backoffice/payment-issues/${orderId}/resolve`, {})).status).toBe(400);
      expect((await gerente.post(`/backoffice/payment-issues/${orderId}/resolve`, { note: 'prueba' })).status).toBe(403);
      expect((await admin.post(`/backoffice/payment-issues/${orderId}/resolve`, { note: 'Reembolsado en Mercado Pago' })).status).toBe(204);
      expect((await admin.post(`/backoffice/payment-issues/${orderId}/resolve`, { note: 'otra vez' })).status).toBe(409);
      expect((await admin.get('/backoffice/payment-issues')).body.some((row: { id: string }) => row.id === orderId)).toBe(false);
    });
  });

  describe('auditoría', () => {
    it('lista con filtros y paginación estable, y la tabla no se puede editar ni borrar', async () => {
      const page1 = (await admin.get('/backoffice/audit?limit=3&page=1')).body;
      const page2 = (await admin.get('/backoffice/audit?limit=3&page=2')).body;
      const ids = [...page1.items, ...page2.items].map((row: { id: string }) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(page1.total).toBeGreaterThan(3);
      expect((await admin.get('/backoffice/audit?from=2020-01-01&to=2020-01-31')).body.total).toBe(0);
      expect((await admin.get('/backoffice/audit?limit=500')).status).toBe(400);
      expect((await admin.get('/backoffice/audit?actorId=nope')).status).toBe(400);
      expect(JSON.stringify(page1)).not.toMatch(/argon2|passwordHash/);
      await expect(fx.prisma.$executeRawUnsafe('DELETE FROM audit_logs')).rejects.toThrow(/inmutable/);
      await expect(fx.prisma.$executeRawUnsafe(`UPDATE audit_logs SET action = 'x'`)).rejects.toThrow(/inmutable/);
    });
  });
});
