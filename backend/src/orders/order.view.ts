import type { Prisma } from '@prisma/client';
import type { ImageUrls } from '../media/media-url.service';

export const orderInclude = {
  branch: { select: { id: true, name: true, address: true } },
  items: { include: { product: { select: { imageKey: true } } }, orderBy: { name: 'asc' } },
  statusEvents: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

export type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface OrderItemView {
  productId: string;
  name: string;
  image: ImageUrls | null;
  quantity: number;
  /** Precio de lista por unidad al comprar. */
  unitPrice: string;
  /** Descuento por unidad al comprar. */
  discountAmount: string;
  lineTotal: string;
}

export interface OrderView {
  id: string;
  number: number;
  status: OrderRecord['status'];
  deliveryMethod: OrderRecord['deliveryMethod'];
  branch: { id: string; name: string; address: string };
  shippingAddress: string | null;
  note: string | null;
  items: OrderItemView[];
  subtotal: string;
  shippingCost: string;
  total: string;
  paymentStatus: string | null;
  /** Hay algo que el personal debe revisar (p. ej. un importe que no coincide). El detalle no se muestra al cliente. */
  needsReview: boolean;
  /** Solo mientras se puede pagar. */
  checkoutUrl: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  cancelReason: string | null;
  /** Por qué estados pasó y cuándo (sin notas internas ni quién lo hizo). */
  history: { status: OrderRecord['status']; at: Date }[];
}

export function toOrderView(
  order: OrderRecord,
  imageUrls: (imageKey: string | null) => ImageUrls | null,
  now: Date = new Date(),
): OrderView {
  const payable = order.status === 'PENDING_PAYMENT' && order.expiresAt !== null && order.expiresAt > now;
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    branch: order.branch,
    shippingAddress: order.shippingAddress,
    note: order.note,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: imageUrls(item.product.imageKey),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      discountAmount: item.discountAmount.toFixed(2),
      lineTotal: item.unitPrice.sub(item.discountAmount).mul(item.quantity).toFixed(2),
    })),
    subtotal: order.subtotal.toFixed(2),
    shippingCost: order.shippingCost.toFixed(2),
    total: order.total.toFixed(2),
    paymentStatus: order.paymentStatus,
    needsReview: order.paymentIssue !== null,
    checkoutUrl: payable ? order.checkoutUrl : null,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    cancelReason: order.cancelReason,
    history: order.statusEvents.map((event) => ({ status: event.toStatus, at: event.createdAt })),
  };
}
