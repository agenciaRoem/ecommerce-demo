import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GatewayError, GatewayPayment } from './gateways/payment-gateway';
import { PaymentReconciliationService } from './payment-reconciliation.service';

const ORDER_ID = '11111111-2222-4333-8444-555555555555';
const credentials = { accessToken: 'APP_USR-x', mode: 'SANDBOX' as const };

const payment = (overrides: Partial<GatewayPayment> = {}): GatewayPayment => ({
  id: '900',
  status: 'approved',
  statusDetail: 'accredited',
  reference: ORDER_ID,
  amount: 5860.5,
  currency: 'ARS',
  ...overrides,
});

function setup(options: { order?: { total: string } | null; credentials?: typeof credentials | null } = {}) {
  const order = options.order === undefined ? { total: '5860.50' } : options.order;
  const prisma = {
    order: { findUnique: jest.fn(async () => (order ? { id: ORDER_ID, customerId: 'c1', total: new Prisma.Decimal(order.total) } : null)) },
    orderItem: { findMany: jest.fn(async () => [{ productId: 'p1', quantity: 2 }]) },
  };
  const settings = { getCredentials: jest.fn(async () => (options.credentials === undefined ? credentials : options.credentials)) };
  const mercadoPago = { getPayment: jest.fn(), searchPayments: jest.fn() };
  const lifecycle = {
    markPaid: jest.fn(async () => 'paid' as const),
    recordPaymentStatus: jest.fn(async () => undefined),
    flagPaymentIssue: jest.fn(async () => undefined),
  };
  const cart = { consume: jest.fn(async () => undefined) };
  const service = new PaymentReconciliationService(prisma as never, settings as never, mercadoPago as never, lifecycle as never, cart as never);
  return { service, prisma, mercadoPago, lifecycle, cart };
}

describe('PaymentReconciliationService.apply', () => {
  it('un pago aprobado con el importe correcto cierra el pedido y vacía lo comprado del carrito', async () => {
    const { service, lifecycle, cart } = setup();
    expect(await service.apply(payment())).toBe('paid');
    expect(lifecycle.markPaid).toHaveBeenCalledWith(ORDER_ID, { id: '900', status: 'approved' });
    expect(cart.consume).toHaveBeenCalledWith('c1', [{ productId: 'p1', quantity: 2 }]);
  });

  it('un importe distinto NO cierra el pedido y lo deja marcado para revisar', async () => {
    const { service, lifecycle } = setup();
    expect(await service.apply(payment({ amount: 100 }))).toBe('amount_mismatch');
    expect(lifecycle.markPaid).not.toHaveBeenCalled();
    expect(lifecycle.flagPaymentIssue).toHaveBeenCalledWith(ORDER_ID, expect.stringContaining('no coincide'));
  });

  it('tolera diferencias de punto flotante en el importe', async () => {
    const { service } = setup({ order: { total: '0.30' } });
    expect(await service.apply(payment({ amount: 0.1 + 0.2 }))).toBe('paid');
  });

  it('rechaza una moneda que no es la del pedido', async () => {
    const { service, lifecycle } = setup();
    expect(await service.apply(payment({ currency: 'USD' }))).toBe('amount_mismatch');
    expect(lifecycle.markPaid).not.toHaveBeenCalled();
  });

  it.each(['pending', 'in_process', 'rejected', 'cancelled'])('un pago "%s" solo se anota, no cierra el pedido', async (status) => {
    const { service, lifecycle, cart } = setup();
    expect(await service.apply(payment({ status }))).toBe('in_progress');
    expect(lifecycle.recordPaymentStatus).toHaveBeenCalledWith(ORDER_ID, status);
    expect(lifecycle.markPaid).not.toHaveBeenCalled();
    expect(cart.consume).not.toHaveBeenCalled();
  });

  it.each([null, '', 'no-es-un-uuid', "'; drop table orders;--"])('ignora un pago con referencia %j (no es de un pedido nuestro)', async (reference) => {
    const { service, prisma } = setup();
    expect(await service.apply(payment({ reference }))).toBe('ignored');
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('ignora un pago cuyo pedido no existe', async () => {
    expect(await setup({ order: null }).service.apply(payment())).toBe('ignored');
  });

  it('un aviso repetido no vacía el carrito dos veces', async () => {
    const { service, lifecycle, cart } = setup();
    lifecycle.markPaid.mockResolvedValue('already_processed' as never);
    expect(await service.apply(payment())).toBe('already_processed');
    expect(cart.consume).not.toHaveBeenCalled();
  });
});

describe('PaymentReconciliationService (consultas a Mercado Pago)', () => {
  it('reconcilePaymentId consulta el pago a Mercado Pago, no confía en el aviso', async () => {
    const { service, mercadoPago } = setup();
    mercadoPago.getPayment.mockResolvedValue(payment());
    expect(await service.reconcilePaymentId('900')).toBe('paid');
    expect(mercadoPago.getPayment).toHaveBeenCalledWith(credentials, '900');
  });

  it('un pago que Mercado Pago no conoce (aviso de prueba) se ignora', async () => {
    const { service, mercadoPago } = setup();
    mercadoPago.getPayment.mockRejectedValue(new GatewayError('no existe', 'rejected'));
    expect(await service.reconcilePaymentId('123456')).toBe('ignored');
  });

  it('un corte de Mercado Pago se informa como error para que reintente', async () => {
    const { service, mercadoPago } = setup();
    mercadoPago.getPayment.mockRejectedValue(new GatewayError('caído', 'unavailable'));
    await expect(service.reconcilePaymentId('900')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('sin pasarela configurada informa error', async () => {
    await expect(setup({ credentials: null }).service.reconcilePaymentId('900')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reconcileOrder por pago: descarta un pago que pertenece a otro pedido', async () => {
    const { service, mercadoPago, lifecycle } = setup();
    mercadoPago.getPayment.mockResolvedValue(payment({ reference: '99999999-2222-4333-8444-555555555555' }));
    expect(await service.reconcileOrder(ORDER_ID, '900')).toBe('ignored');
    expect(lifecycle.markPaid).not.toHaveBeenCalled();
  });

  it('reconcileOrder sin pago informado: busca por referencia y prefiere el aprobado', async () => {
    const { service, mercadoPago, lifecycle } = setup();
    mercadoPago.searchPayments.mockResolvedValue([payment({ id: '2', status: 'rejected' }), payment({ id: '1', status: 'approved' })]);
    expect(await service.reconcileOrder(ORDER_ID)).toBe('paid');
    expect(mercadoPago.searchPayments).toHaveBeenCalledWith(credentials, ORDER_ID);
    expect(lifecycle.markPaid).toHaveBeenCalledWith(ORDER_ID, { id: '1', status: 'approved' });
  });

  it('reconcileOrder sin pagos devuelve ignorado', async () => {
    const { service, mercadoPago } = setup();
    mercadoPago.searchPayments.mockResolvedValue([]);
    expect(await service.reconcileOrder(ORDER_ID)).toBe('ignored');
  });
});
