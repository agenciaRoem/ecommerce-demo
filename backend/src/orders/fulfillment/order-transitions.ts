import type { DeliveryMethod, OrderStatus } from '@prisma/client';

/** Estados que forman la cola de trabajo de la sucursal (los de pago y cancelación los mueve el sistema). */
export const ACTIVE_STATUSES = ['PENDING', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'READY_FOR_FREIGHT'] as const satisfies readonly OrderStatus[];
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

const READY_BY_DELIVERY: Record<DeliveryMethod, OrderStatus> = {
  PICKUP: 'READY_FOR_PICKUP', // el cliente retira en el mostrador
  SHIPPING: 'READY_FOR_FREIGHT', // queda listo para el flete (B2B)
};

export interface OrderActions {
  /** El paso siguiente del trabajo, o `null` si no hay (pedido entregado o fuera de la cola). */
  forward: OrderStatus | null;
  /** Deshacer un paso dado por error, o `null` si no corresponde. */
  back: OrderStatus | null;
}

/**
 * Qué puede hacer el personal con un pedido según su estado y su forma de entrega:
 *   Pendiente → En preparación → Listo para retirar / Listo para flete → Entregado
 * y, mientras no esté entregado, volver un paso atrás. Un pedido entregado no se reabre.
 */
export function actionsFor(status: OrderStatus, delivery: DeliveryMethod): OrderActions {
  switch (status) {
    case 'PENDING':
      return { forward: 'IN_PREPARATION', back: null };
    case 'IN_PREPARATION':
      return { forward: READY_BY_DELIVERY[delivery], back: 'PENDING' };
    case 'READY_FOR_PICKUP':
    case 'READY_FOR_FREIGHT':
      return { forward: 'COMPLETED', back: 'IN_PREPARATION' };
    default:
      return { forward: null, back: null };
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus, delivery: DeliveryMethod): boolean {
  const { forward, back } = actionsFor(from, delivery);
  return to === forward || to === back;
}
