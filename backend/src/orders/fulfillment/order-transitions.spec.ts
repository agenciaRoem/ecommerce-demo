import type { OrderStatus } from '@prisma/client';
import { ACTIVE_STATUSES, actionsFor, canTransition } from './order-transitions';

describe('actionsFor', () => {
  it('retiro en sucursal: Pendiente → En preparación → Listo para retirar → Entregado', () => {
    expect(actionsFor('PENDING', 'PICKUP')).toEqual({ forward: 'IN_PREPARATION', back: null });
    expect(actionsFor('IN_PREPARATION', 'PICKUP')).toEqual({ forward: 'READY_FOR_PICKUP', back: 'PENDING' });
    expect(actionsFor('READY_FOR_PICKUP', 'PICKUP')).toEqual({ forward: 'COMPLETED', back: 'IN_PREPARATION' });
  });

  it('envío (B2B): queda Listo para flete, nunca Listo para retirar', () => {
    expect(actionsFor('IN_PREPARATION', 'SHIPPING').forward).toBe('READY_FOR_FREIGHT');
    expect(actionsFor('READY_FOR_FREIGHT', 'SHIPPING')).toEqual({ forward: 'COMPLETED', back: 'IN_PREPARATION' });
  });

  it.each<OrderStatus>(['PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'])('%s no tiene acciones para el personal', (status) => {
    expect(actionsFor(status, 'PICKUP')).toEqual({ forward: null, back: null });
  });
});

describe('canTransition', () => {
  it('permite el paso siguiente y deshacerlo', () => {
    expect(canTransition('PENDING', 'IN_PREPARATION', 'PICKUP')).toBe(true);
    expect(canTransition('IN_PREPARATION', 'PENDING', 'PICKUP')).toBe(true);
    expect(canTransition('READY_FOR_PICKUP', 'IN_PREPARATION', 'PICKUP')).toBe(true);
  });

  it('no permite saltear pasos', () => {
    expect(canTransition('PENDING', 'READY_FOR_PICKUP', 'PICKUP')).toBe(false);
    expect(canTransition('PENDING', 'COMPLETED', 'PICKUP')).toBe(false);
    expect(canTransition('IN_PREPARATION', 'COMPLETED', 'PICKUP')).toBe(false);
  });

  it('no mezcla retiro con flete', () => {
    expect(canTransition('IN_PREPARATION', 'READY_FOR_FREIGHT', 'PICKUP')).toBe(false);
    expect(canTransition('IN_PREPARATION', 'READY_FOR_PICKUP', 'SHIPPING')).toBe(false);
  });

  it('el personal no toca pagos ni cancelaciones, y un pedido entregado no se reabre', () => {
    expect(canTransition('PENDING_PAYMENT', 'PENDING', 'PICKUP')).toBe(false);
    expect(canTransition('PENDING', 'CANCELLED', 'PICKUP')).toBe(false);
    expect(canTransition('COMPLETED', 'READY_FOR_PICKUP', 'PICKUP')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING', 'PICKUP')).toBe(false);
  });

  it('un estado no pasa a sí mismo', () => {
    for (const status of ACTIVE_STATUSES) expect(canTransition(status, status, 'PICKUP')).toBe(false);
  });
});
