import type { OrderStatus } from '@/lib/shop-api';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Esperando el pago',
  PENDING: 'Pagado',
  IN_PREPARATION: 'En preparación',
  READY_FOR_PICKUP: 'Listo para retirar',
  READY_FOR_FREIGHT: 'Listo para despacho',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-warning-soft text-warning',
  PENDING: 'bg-success-soft text-success',
  IN_PREPARATION: 'bg-brand-soft text-brand',
  READY_FOR_PICKUP: 'bg-success-soft text-success',
  READY_FOR_FREIGHT: 'bg-success-soft text-success',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-muted text-muted-foreground',
};

/** Por qué se canceló, dicho para el cliente. */
export const CANCEL_REASON_TEXT: Record<string, string> = {
  expired: 'El plazo para pagar venció y liberamos tu reserva de stock.',
  replaced: 'Reemplazaste este pedido por uno nuevo.',
  customer: 'Cancelaste este pedido.',
  payment_unavailable: 'No pudimos iniciar el pago de este pedido.',
};
