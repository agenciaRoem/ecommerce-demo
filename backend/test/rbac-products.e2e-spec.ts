import { INestApplication } from '@nestjs/common';
import { STAFF } from './support/constants';
import { Client, Fixture, adminClient, createApp, createProduct, loadFixture, staffClient, uniq } from './support/harness';

type Role = 'ANON' | 'SALA' | 'STOCKEO' | 'ENCARGADO_STOCK' | 'GERENTE' | 'SUPERADMIN';

describe('Permisos por rol y productos', () => {
  let app: INestApplication;
  let fx: Fixture;
  const clients = {} as Record<Role, Client>;

  beforeAll(async () => {
    app = await createApp();
    fx = await loadFixture(app);
    clients.ANON = new Client(app);
    clients.SALA = await staffClient(app, STAFF.salaCen);
    clients.STOCKEO = await staffClient(app, STAFF.stockeoCen);
    clients.ENCARGADO_STOCK = await staffClient(app, STAFF.encargadoCen);
    clients.GERENTE = await staffClient(app, STAFF.gerenteCen);
    clients.SUPERADMIN = await adminClient(app);
  });
  afterAll(() => app.close());

  /** Quién puede llamar a cada endpoint de lectura. Cualquier otro rol tiene que recibir 403 (o 401 sin sesión). */
  const GET_MATRIX: [string, Role[]][] = [
    ['/backoffice/analytics/overview', ['GERENTE', 'SUPERADMIN']],
    ['/backoffice/analytics/low-stock', ['GERENTE', 'SUPERADMIN']],
    ['/backoffice/abandoned-carts', ['GERENTE', 'SUPERADMIN']],
    ['/backoffice/prices', ['GERENTE', 'SUPERADMIN']],
    ['/backoffice/promotions', ['GERENTE', 'SUPERADMIN']],
    ['/backoffice/branches', ['SUPERADMIN']],
    ['/backoffice/staff', ['SUPERADMIN']],
    ['/backoffice/audit', ['SUPERADMIN']],
    ['/backoffice/commerce-customers', ['SUPERADMIN']],
    ['/backoffice/payment-issues', ['SUPERADMIN']],
    ['/admin/payments/mercadopago', ['SUPERADMIN']],
    ['/branch/orders', ['SALA', 'GERENTE', 'SUPERADMIN']],
    ['/inventory', ['STOCKEO', 'SALA', 'GERENTE', 'SUPERADMIN']],
  ];

  it.each(GET_MATRIX)('GET %s', async (path, allowed) => {
    for (const role of Object.keys(clients) as Role[]) {
      const res = await clients[role].get(path);
      if (role === 'ANON') expect(res.status).toBe(401);
      else if (allowed.includes(role)) expect(res.status).toBe(200);
      else expect(res.status).toBe(403);
    }
  });

  describe('aislamiento por sucursal', () => {
    it('un gerente no puede mirar ni operar otra sucursal', async () => {
      expect((await clients.GERENTE.get(`/backoffice/analytics/overview?branchId=${fx.norId}`)).status).toBe(403);
      expect((await clients.SALA.get(`/branch/orders?branchId=${fx.norId}`)).status).toBe(403);
    });

    it('el superadmin elige la sucursal con ?branchId=', async () => {
      expect((await clients.SUPERADMIN.get(`/backoffice/analytics/overview?branchId=${fx.norId}`)).status).toBe(200);
      expect((await clients.SUPERADMIN.get(`/branch/orders?branchId=${fx.norId}`)).status).toBe(200);
    });

    it('el stock de una sucursal no se ve ni se toca desde otra', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 10);
      const salaNor = await staffClient(app, STAFF.salaNor);
      const adjust = await salaNor.post('/inventory/adjustments', { productId: product.id, delta: -1, reason: 'LOST' });
      expect(adjust.status).toBeGreaterThanOrEqual(400); // NOR no tiene ese producto en su inventario
      const stock = await fx.prisma.branchInventory.findMany({ where: { productId: product.id } });
      expect(stock.map((row) => [row.branchId, row.stock])).toEqual([[fx.cenId, 10]]);
    });
  });

  describe('encargado de stock: solo alta y edición de productos', () => {
    it('da de alta un producto sin stock aunque mande unidades, con el precio inicial calculado', async () => {
      const res = await clients.ENCARGADO_STOCK.post('/products', { name: `Enc ${uniq()}`, categoryId: fx.categoryId, cost: 500, quantity: 99, description: 'Lo da de alta el encargado' });
      expect(res.status).toBe(201);
      expect(Number(res.body.retailPrice)).toBeGreaterThan(500);
      const stock = await fx.prisma.branchInventory.aggregate({ where: { productId: res.body.id }, _sum: { stock: true } });
      expect(stock._sum.stock ?? 0).toBe(0);
    });

    it('corrige nombre, categoría, código y descripción, y queda auditado', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5);
      const res = await clients.ENCARGADO_STOCK.patch(`/products/${product.id}`, { name: `Editado ${uniq()}`, description: 'Nueva', barcode: `7${Date.now()}`.slice(0, 14) });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Nueva');
      const audit = await fx.prisma.auditLog.count({ where: { action: 'product.updated', entityId: product.id } });
      expect(audit).toBe(1);
    });

    it('no puede cambiar precios ni costo: esos campos se ignoran y no hay nada que guardar', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5);
      const before = await fx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect((await clients.ENCARGADO_STOCK.patch(`/products/${product.id}`, { retailPrice: 1, cost: 1 })).status).toBe(400);
      const after = await fx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect([after.retailPrice, after.cost]).toEqual([before.retailPrice, before.cost]);
    });

    it.each([
      ['POST', '/inventory/receipts'],
      ['POST', '/inventory/adjustments'],
      ['PATCH', '/backoffice/prices/00000000-0000-4000-8000-000000000000'],
      ['POST', '/backoffice/prices/bulk/preview'],
      ['POST', '/backoffice/promotions'],
      ['POST', '/backoffice/staff'],
      ['POST', '/branch/orders/00000000-0000-4000-8000-000000000000/status'],
    ])('%s %s -> 403', async (method, path) => {
      const client = clients.ENCARGADO_STOCK;
      const res = method === 'PATCH' ? await client.patch(path, {}) : await client.post(path, {});
      expect(res.status).toBe(403);
    });

    it('el stockeo común y la sala no editan productos; gerente y superadmin sí', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5);
      expect((await clients.STOCKEO.patch(`/products/${product.id}`, { name: 'Intento' })).status).toBe(403);
      expect((await clients.SALA.patch(`/products/${product.id}`, { name: 'Intento' })).status).toBe(403);
      expect((await clients.GERENTE.patch(`/products/${product.id}`, { description: 'Gerente' })).status).toBe(200);
      expect((await clients.SUPERADMIN.patch(`/products/${product.id}`, { description: 'Superadmin' })).status).toBe(200);
    });

    it('valida los datos: código repetido, categoría inexistente, producto inexistente', async () => {
      const a = await createProduct(clients.STOCKEO, fx.categoryId, 1);
      const code = `8${Date.now()}`.slice(0, 14);
      expect((await clients.ENCARGADO_STOCK.patch(`/products/${a.id}`, { barcode: code })).status).toBe(200);
      const b = await createProduct(clients.STOCKEO, fx.categoryId, 1);
      expect((await clients.ENCARGADO_STOCK.patch(`/products/${b.id}`, { barcode: code })).status).toBe(409);
      expect((await clients.ENCARGADO_STOCK.patch(`/products/${b.id}`, { categoryId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
      expect((await clients.ENCARGADO_STOCK.patch('/products/00000000-0000-4000-8000-000000000000', { name: 'Nadie' })).status).toBe(404);
      expect((await clients.ENCARGADO_STOCK.patch(`/products/${b.id}`, { name: `a${String.fromCharCode(0)}b` })).status).toBe(400);
    });
  });

  describe('precios y costos (gerente y superadmin)', () => {
    it('no deja vender por debajo del costo ni el mayorista sobre el minorista', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5, 700);
      expect((await clients.GERENTE.patch(`/backoffice/prices/${product.id}`, { retailPrice: 500 })).status).toBe(400);
      expect((await clients.GERENTE.patch(`/backoffice/prices/${product.id}`, { retailPrice: 1000, wholesalePrice: 1100 })).status).toBe(400);
      expect((await clients.GERENTE.patch(`/backoffice/prices/${product.id}`, { retailPrice: 1000.123 })).status).toBe(400);
    });

    it('guarda el cambio con su historial, y el historial es inmutable', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5, 700);
      const ok = await clients.GERENTE.patch(`/backoffice/prices/${product.id}`, { retailPrice: 1200.5, wholesalePrice: 1000, note: 'ajuste e2e' });
      expect(ok.status).toBe(200);
      expect(ok.body.retailMarginPercent).toBe('71.5');
      const history = await clients.GERENTE.get(`/backoffice/prices/${product.id}/history`);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toMatchObject({ note: 'ajuste e2e', retailPrice: { to: '1200.50' } });
      await expect(fx.prisma.$executeRawUnsafe(`UPDATE product_price_changes SET note = 'x' WHERE product_id = '${product.id}'`)).rejects.toThrow(/inmutable/);
      await expect(fx.prisma.$executeRawUnsafe(`DELETE FROM product_price_changes WHERE product_id = '${product.id}'`)).rejects.toThrow(/inmutable/);
    });

    it('el cambio masivo muestra una vista previa, bloquea lo inválido y aplica lo válido', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5, 700);
      const target = { scope: 'PRODUCTS', productIds: [product.id] };

      const bad = await clients.GERENTE.post('/backoffice/prices/bulk/preview', { target, change: { mode: 'ADJUST_PRICES', percent: -80, applyTo: 'RETAIL' } });
      expect(bad.body).toMatchObject({ canApply: false, problems: { BELOW_COST: 1 } });
      expect((await clients.GERENTE.post('/backoffice/prices/bulk/apply', { target, change: { mode: 'ADJUST_PRICES', percent: -80, applyTo: 'RETAIL' } })).status).toBe(400);

      const change = { mode: 'ADJUST_COST', percent: 20 };
      const preview = await clients.GERENTE.post('/backoffice/prices/bulk/preview', { target, change, rounding: 'UNIT' });
      expect(preview.body).toMatchObject({ matched: 1, changed: 1, canApply: true });
      const untouched = await fx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(untouched.cost.toFixed(2)).toBe('700.00'); // la vista previa no guarda

      expect((await clients.GERENTE.post('/backoffice/prices/bulk/apply', { target, change, rounding: 'UNIT' })).body).toEqual({ changed: 1 });
      const applied = await fx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
      expect(applied.cost.toFixed(2)).toBe('840.00');
    });

    it('cambios simultáneos sobre un producto: ninguno falla con 500 y el historial coincide con lo aceptado', async () => {
      const product = await createProduct(clients.STOCKEO, fx.categoryId, 5, 700);
      const results = await Promise.all([1, 2, 3, 4, 5].map((i) => clients.GERENTE.patch(`/backoffice/prices/${product.id}`, { retailPrice: 2000 + i })));
      const statuses = results.map((res) => res.status);
      expect(statuses.every((status) => status === 200 || status === 409)).toBe(true);
      const accepted = statuses.filter((status) => status === 200).length;
      expect(accepted).toBeGreaterThanOrEqual(1);
      expect(await fx.prisma.productPriceChange.count({ where: { productId: product.id } })).toBe(accepted);
    });
  });
});
