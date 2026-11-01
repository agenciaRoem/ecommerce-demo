import { Prisma } from '@prisma/client';
import { OrderRecord, toOrderView } from './order.view';

const D = (value: string | number) => new Prisma.Decimal(value);
const noImages = () => null;
const now = new Date('2026-11-01T12:00:00Z');

const order = (overrides: Partial<OrderRecord> = {}): OrderRecord =>
  ({
    id: 'o1',
    number: 7,
    status: 'PENDING_PAYMENT',
    deliveryMethod: 'PICKUP',
    branch: { id: 'b1', name: 'Sucursal Centro', address: 'Calle 1' },
    shippingAddress: null,
    note: null,
    items: [
      { productId: 'p1', name: 'Cuaderno', quantity: 2, unitPrice: D('3600.00'), discountAmount: D('720.00'), product: { imageKey: null } },
      { productId: 'p2', name: 'Lápiz', quantity: 1, unitPrice: D('100.50'), discountAmount: D('0'), product: { imageKey: null } },
    ],
    subtotal: D('5860.50'),
    shippingCost: D('0'),
    total: D('5860.50'),
    paymentStatus: null,
    paymentIssue: null,
    checkoutUrl: 'https://mp/checkout',
    expiresAt: new Date('2026-11-01T12:30:00Z'),
    createdAt: new Date('2026-11-01T12:00:00Z'),
    paidAt: null,
    cancelReason: null,
    statusEvents: [
      { toStatus: 'PENDING_PAYMENT', createdAt: new Date('2026-11-01T12:00:00Z') },
      { toStatus: 'PENDING', createdAt: new Date('2026-11-01T12:10:00Z') },
    ],
    ...overrides,
  }) as unknown as OrderRecord;

describe('toOrderView', () => {
  it('calcula el total de cada línea con el descuento congelado', () => {
    const view = toOrderView(order(), noImages, now);
    expect(view.items.map((i) => i.lineTotal)).toEqual(['5760.00', '100.50']);
    expect(view.items[0]).toMatchObject({ unitPrice: '3600.00', discountAmount: '720.00' });
    expect(view.total).toBe('5860.50');
  });

  it('expone el enlace de pago solo mientras se puede pagar', () => {
    expect(toOrderView(order(), noImages, now).checkoutUrl).toBe('https://mp/checkout');
    expect(toOrderView(order(), noImages, new Date('2026-11-01T13:00:00Z')).checkoutUrl).toBeNull(); // vencido
    expect(toOrderView(order({ status: 'PENDING' }), noImages, now).checkoutUrl).toBeNull(); // ya pagado
    expect(toOrderView(order({ status: 'CANCELLED' }), noImages, now).checkoutUrl).toBeNull();
  });

  it('avisa que requiere revisión sin revelar el detalle interno', () => {
    const view = toOrderView(order({ paymentIssue: 'El importe no coincide: 1 vs 2' }), noImages, now);
    expect(view.needsReview).toBe(true);
    expect(JSON.stringify(view)).not.toContain('no coincide');
    expect(toOrderView(order(), noImages, now).needsReview).toBe(false);
  });

  it('muestra la línea de tiempo sin notas internas ni quién cambió el estado', () => {
    const view = toOrderView(order(), noImages, now);
    expect(view.history).toEqual([
      { status: 'PENDING_PAYMENT', at: new Date('2026-11-01T12:00:00Z') },
      { status: 'PENDING', at: new Date('2026-11-01T12:10:00Z') },
    ]);
    expect(JSON.stringify(view.history)).not.toMatch(/userId|note/);
  });

  it('no expone datos internos de la pasarela', () => {
    const serialized = JSON.stringify(toOrderView(order(), noImages, now));
    expect(serialized).not.toMatch(/paymentId|checkoutId|paymentProvider|customerId/);
  });
});
