import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FulfillmentService } from './fulfillment.service';
import { StaffOrderRecord, toStaffOrderView } from './staff-order.view';

const ORDER_ID = '11111111-2222-4333-8444-555555555555';

const record = (overrides: Partial<StaffOrderRecord> = {}): StaffOrderRecord =>
  ({
    id: ORDER_ID,
    number: 12,
    status: 'PENDING',
    deliveryMethod: 'PICKUP',
    branch: { id: 'b1', name: 'Sucursal Centro' },
    customer: { fullName: 'Laura Pérez', phone: '11 5555-0000', businessName: null },
    shippingAddress: null,
    note: 'Retira después de las 17',
    items: [
      { productId: 'p1', sku: 'SKU-1', name: 'Cuaderno', quantity: 2, unitPrice: new Prisma.Decimal(3600), product: { barcode: '779', imageKey: null } },
      { productId: 'p2', sku: 'SKU-2', name: 'Lápiz', quantity: 3, unitPrice: new Prisma.Decimal(100), product: { barcode: null, imageKey: null } },
    ],
    total: new Prisma.Decimal('7500.00'),
    paidAt: new Date('2026-11-02T10:00:00Z'),
    createdAt: new Date('2026-11-02T09:55:00Z'),
    updatedAt: new Date('2026-11-02T10:00:00Z'),
    statusEvents: [{ toStatus: 'PENDING', createdAt: new Date('2026-11-02T10:00:00Z') }],
    ...overrides,
  }) as unknown as StaffOrderRecord;

function setup(found: { status: string; deliveryMethod: string } | null, claimed = 1) {
  const tx = {
    order: { updateMany: jest.fn(async () => ({ count: claimed })) },
    orderStatusEvent: { create: jest.fn(async () => undefined) },
  };
  const prisma = {
    order: {
      findFirst: jest.fn(async (args: { select?: unknown }) => (args.select ? found && { id: ORDER_ID, ...found } : record())),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new FulfillmentService(prisma as never, { forKey: () => null } as never), prisma, tx };
}

describe('toStaffOrderView', () => {
  it('muestra qué preparar y para quién, sin costos ni datos de pago', () => {
    const view = toStaffOrderView(record(), () => null);
    expect(view).toMatchObject({ number: 12, units: 5, customer: { name: 'Laura Pérez', phone: '11 5555-0000' } });
    expect(view.items[0]).toMatchObject({ sku: 'SKU-1', barcode: '779', quantity: 2 });
    expect(JSON.stringify(view)).not.toMatch(/unitPrice|cost|paymentId|checkoutUrl|paymentIssue|email/i);
  });

  it('informa qué acciones puede hacer el empleado según el estado y la entrega', () => {
    expect(toStaffOrderView(record(), () => null).actions).toEqual({ forward: 'IN_PREPARATION', back: null });
    expect(toStaffOrderView(record({ status: 'IN_PREPARATION', deliveryMethod: 'SHIPPING' }), () => null).actions.forward).toBe('READY_FOR_FREIGHT');
  });

  it('calcula desde cuándo está en el estado actual', () => {
    const view = toStaffOrderView(
      record({ statusEvents: [{ toStatus: 'PENDING', createdAt: new Date('2026-11-02T10:00:00Z') }, { toStatus: 'IN_PREPARATION', createdAt: new Date('2026-11-02T10:20:00Z') }] as never }),
      () => null,
    );
    expect(view.statusSince).toEqual(new Date('2026-11-02T10:20:00Z'));
  });
});

describe('FulfillmentService.transition', () => {
  const scope = { branchId: 'b1' };

  it('aplica el paso, deja el evento con quién lo hizo y devuelve el pedido', async () => {
    const { service, tx } = setup({ status: 'PENDING', deliveryMethod: 'PICKUP' });
    await service.transition(scope, 'user-1', ORDER_ID, 'IN_PREPARATION');
    expect(tx.order.updateMany).toHaveBeenCalledWith({ where: { id: ORDER_ID, status: 'PENDING' }, data: { status: 'IN_PREPARATION' } });
    expect(tx.orderStatusEvent.create).toHaveBeenCalledWith({
      data: { orderId: ORDER_ID, fromStatus: 'PENDING', toStatus: 'IN_PREPARATION', userId: 'user-1' },
    });
  });

  it('un pedido de otra sucursal (fuera del alcance) es 404, igual que uno inexistente', async () => {
    const { service, prisma } = setup(null);
    await expect(service.transition(scope, 'user-1', ORDER_ID, 'IN_PREPARATION')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORDER_ID, branchId: 'b1' } }));
  });

  it('rechaza saltear un paso y no escribe nada', async () => {
    const { service, prisma } = setup({ status: 'PENDING', deliveryMethod: 'PICKUP' });
    await expect(service.transition(scope, 'user-1', ORDER_ID, 'READY_FOR_PICKUP')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('si otro empleado lo movió primero, no lo pisa ni registra un evento falso', async () => {
    const { service, tx } = setup({ status: 'PENDING', deliveryMethod: 'PICKUP' }, 0);
    await expect(service.transition(scope, 'user-1', ORDER_ID, 'IN_PREPARATION')).rejects.toThrow(/Otro empleado/);
    expect(tx.orderStatusEvent.create).not.toHaveBeenCalled();
  });

  it('el SUPERADMIN (sin sucursal en el alcance) puede mover pedidos de cualquier sucursal', async () => {
    const { service, prisma } = setup({ status: 'PENDING', deliveryMethod: 'PICKUP' });
    await service.transition({}, 'admin', ORDER_ID, 'IN_PREPARATION');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORDER_ID } }));
  });
});
