import { INestApplication } from '@nestjs/common';
import { OrderLifecycleService } from '../src/orders/lifecycle/order-lifecycle.service';
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
  nextPaymentId,
  registerCustomer,
  sendWebhook,
  staffClient,
} from './support/harness';

describe('Compra, pago y operación de sala', () => {
  let app: INestApplication;
  let fx: Fixture;
  let stockeo: Client;
  let salaCen: Client;
  let salaNor: Client;

  const stockOf = async (productId: string) => {
    const row = await fx.prisma.branchInventory.findUniqueOrThrow({ where: { branchId_productId: { branchId: fx.cenId, productId } } });
    return { stock: row.stock, reserved: row.reserved };
  };

  beforeAll(async () => {
    app = await createApp();
    fx = await loadFixture(app);
    stockeo = await staffClient(app, STAFF.stockeoCen);
    salaCen = await staffClient(app, STAFF.salaCen);
    salaNor = await staffClient(app, STAFF.salaNor);
    await configureGateway(await adminClient(app));
  });
  beforeEach(() => mock.reset());
  afterAll(() => app.close());

  describe('checkout', () => {
    it('reserva el stock y devuelve el enlace de pago; al pagarse lo descuenta y libera la reserva', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 10);
      const customer = await registerCustomer(app);

      await customer.client.post('/cart/items', { productId: product.id, quantity: 2 });
      const checkout = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      expect(checkout.status).toBe(201);
      expect(checkout.body.checkoutUrl).toContain('mercadopago');
      expect(checkout.body.order.status).toBe('PENDING_PAYMENT');
      expect(await stockOf(product.id)).toEqual({ stock: 10, reserved: 2 });

      const orderId = checkout.body.order.id as string;
      const paymentId = nextPaymentId();
      await mock.payment({ id: paymentId, status: 'approved', external_reference: orderId, amount: Number(checkout.body.order.total) });
      expect((await sendWebhook(new Client(app), paymentId)).status).toBe(200);

      expect(await stockOf(product.id)).toEqual({ stock: 8, reserved: 0 });
      const order = await fx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('PENDING');
      expect(order.paymentId).toBe(String(paymentId));
      expect(await fx.prisma.stockMovement.count({ where: { orderId, reason: 'SALE' } })).toBe(1);
    });

    it('un retail no puede pedir envío a domicilio; un comercio sí', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 10);
      const retail = await registerCustomer(app, 'RETAIL');
      await retail.client.post('/cart/items', { productId: product.id, quantity: 1 });
      expect((await retail.client.post('/checkout', { deliveryMethod: 'SHIPPING', branchId: fx.cenId })).status).toBeGreaterThanOrEqual(400);

      const commerce = await registerCustomer(app, 'COMMERCE');
      await commerce.client.post('/cart/items', { productId: product.id, quantity: 1 });
      expect((await commerce.client.post('/checkout', { deliveryMethod: 'SHIPPING', branchId: fx.cenId })).status).toBe(201);
    });

    it('sin stock suficiente responde 409 y no reserva nada', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 1);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 5 });
      expect((await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId })).status).toBe(409);
      expect(await stockOf(product.id)).toEqual({ stock: 1, reserved: 0 });
    });

    it('si la pasarela falla no queda stock reservado ni pedido colgado', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 2 });
      await mock.fail(true);
      const checkout = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      expect(checkout.status).not.toBe(201);
      expect(await stockOf(product.id)).toEqual({ stock: 5, reserved: 0 });
      expect(await fx.prisma.order.count({ where: { customerId: customer.id, status: 'PENDING_PAYMENT' } })).toBe(0);
    });

    it('un pedido vencido libera su reserva', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 3 });
      const checkout = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      const orderId = checkout.body.order.id as string;
      expect(await stockOf(product.id)).toEqual({ stock: 5, reserved: 3 });

      await fx.prisma.order.update({ where: { id: orderId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
      await app.get(OrderLifecycleService).expireDue();

      expect((await fx.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('CANCELLED');
      expect(await stockOf(product.id)).toEqual({ stock: 5, reserved: 0 });
    });
  });

  describe('avisos de pago (webhook)', () => {
    it('rechaza un aviso con firma inválida y no cambia nada', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      const checkout = await (async () => {
        await customer.client.post('/cart/items', { productId: product.id, quantity: 1 });
        return customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      })();
      const paymentId = nextPaymentId();
      await mock.payment({ id: paymentId, status: 'approved', external_reference: checkout.body.order.id, amount: Number(checkout.body.order.total) });

      expect((await sendWebhook(new Client(app), paymentId, 'secreto-equivocado')).status).toBe(401);
      expect((await new Client(app).post(`/payments/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {})).status).toBe(401);
      expect((await fx.prisma.order.findUniqueOrThrow({ where: { id: checkout.body.order.id } })).status).toBe('PENDING_PAYMENT');
    });

    it('un aviso repetido no duplica el descuento de stock', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      const { orderId } = await buyAndPay(app, customer, { productId: product.id, branchId: fx.cenId });
      const payment = await fx.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      for (let i = 0; i < 3; i++) expect((await sendWebhook(new Client(app), payment.paymentId!)).status).toBe(200);
      expect(await stockOf(product.id)).toEqual({ stock: 4, reserved: 0 });
      expect(await fx.prisma.stockMovement.count({ where: { orderId, reason: 'SALE' } })).toBe(1);
    });

    it('un pago por otro importe no cierra el pedido y queda marcado para revisión', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 1 });
      const checkout = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      const paymentId = nextPaymentId();
      await mock.payment({ id: paymentId, status: 'approved', external_reference: checkout.body.order.id, amount: 1 });
      await sendWebhook(new Client(app), paymentId);
      const order = await fx.prisma.order.findUniqueOrThrow({ where: { id: checkout.body.order.id } });
      expect(order.status).toBe('PENDING_PAYMENT');
      expect(order.paymentIssue).toBeTruthy();
    });

    it('un pago rechazado deja el pedido sin pagar', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 1 });
      const checkout = await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId });
      const paymentId = nextPaymentId();
      await mock.payment({ id: paymentId, status: 'rejected', external_reference: checkout.body.order.id, amount: Number(checkout.body.order.total) });
      await sendWebhook(new Client(app), paymentId);
      expect((await fx.prisma.order.findUniqueOrThrow({ where: { id: checkout.body.order.id } })).status).toBe('PENDING_PAYMENT');
    });
  });

  describe('operación de sala', () => {
    it('lleva el pedido por sus estados, no deja saltear pasos y registra quién lo movió', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const { orderId } = await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId });

      const queue = await salaCen.get('/branch/orders');
      expect(queue.body.items.some((order: { id: string }) => order.id === orderId)).toBe(true);

      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'COMPLETED' })).status).toBeGreaterThanOrEqual(400); // no se saltea
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'IN_PREPARATION' })).status).toBe(200);
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'READY_FOR_FREIGHT' })).status).toBeGreaterThanOrEqual(400); // retiro ≠ flete
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'READY_FOR_PICKUP' })).status).toBe(200);
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'IN_PREPARATION' })).status).toBe(200); // deshacer
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'READY_FOR_PICKUP' })).status).toBe(200);
      expect((await salaCen.post(`/branch/orders/${orderId}/status`, { status: 'COMPLETED' })).status).toBe(200);

      const events = await fx.prisma.orderStatusEvent.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
      expect(events.at(-1)?.toStatus).toBe('COMPLETED');
      expect(events.filter((event) => event.userId !== null).length).toBeGreaterThanOrEqual(5);
      await expect(fx.prisma.$executeRawUnsafe(`UPDATE order_status_events SET note = 'x' WHERE order_id = '${orderId}'`)).rejects.toThrow(/inmutable/);
    });

    it('la sala de otra sucursal no ve ni mueve el pedido', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const { orderId } = await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId });
      expect((await salaNor.get(`/branch/orders/${orderId}`)).status).toBe(404);
      expect((await salaNor.post(`/branch/orders/${orderId}/status`, { status: 'IN_PREPARATION' })).status).toBe(404);
      const queue = await salaNor.get('/branch/orders');
      expect(queue.body.items.some((order: { id: string }) => order.id === orderId)).toBe(false);
    });

    it('dos empleados sobre el mismo pedido: gana uno y el otro recibe 409', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const { orderId } = await buyAndPay(app, await registerCustomer(app), { productId: product.id, branchId: fx.cenId });
      const other = await staffClient(app, STAFF.gerenteCen);
      const results = await Promise.all([salaCen, other].map((client) => client.post(`/branch/orders/${orderId}/status`, { status: 'IN_PREPARATION' })));
      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    });

    it('el ajuste de emergencia nunca baja el stock por debajo de lo reservado', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 5);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 3 });
      await customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId }); // reserva 3
      const tooMuch = await salaCen.post('/inventory/adjustments', { productId: product.id, delta: -3, reason: 'LOST' });
      expect(tooMuch.status).toBe(409);
      expect((await salaCen.post('/inventory/adjustments', { productId: product.id, delta: -2, reason: 'LOST' })).status).toBe(201);
      expect(await stockOf(product.id)).toEqual({ stock: 3, reserved: 3 });
    });
  });

  describe('concurrencia (ACID)', () => {
    it('8 compradores a la vez por 3 unidades: exactamente 3 ganan, nadie sobrevende', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 3);
      const customers = await Promise.all(Array.from({ length: 8 }, () => registerCustomer(app)));
      await Promise.all(customers.map((customer) => customer.client.post('/cart/items', { productId: product.id, quantity: 1 })));

      const results = await Promise.all(customers.map((customer) => customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId })));
      const statuses = results.map((res) => res.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(3);
      expect(statuses.filter((status) => status === 409)).toHaveLength(5);
      expect(statuses.some((status) => status >= 500)).toBe(false);
      expect(await stockOf(product.id)).toEqual({ stock: 3, reserved: 3 });
    });

    it('el mismo cliente enviando dos checkouts a la vez no reserva de más', async () => {
      const product = await createProduct(stockeo, fx.categoryId, 4);
      const customer = await registerCustomer(app);
      await customer.client.post('/cart/items', { productId: product.id, quantity: 3 });
      const results = await Promise.all([1, 2].map(() => customer.client.post('/checkout', { deliveryMethod: 'PICKUP', branchId: fx.cenId })));
      expect(results.some((res) => res.status >= 500)).toBe(false);
      const { reserved } = await stockOf(product.id);
      expect(reserved).toBeLessThanOrEqual(4);
      expect(reserved).toBeGreaterThanOrEqual(3);
    });
  });
});
