import type { Prisma } from '@prisma/client';
import type { ImageUrls } from '../../media/media-url.service';
import { OrderActions, actionsFor } from './order-transitions';

export const staffOrderInclude = {
  branch: { select: { id: true, name: true } },
  customer: { select: { fullName: true, phone: true, businessName: true } },
  items: { include: { product: { select: { barcode: true, imageKey: true } } }, orderBy: { name: 'asc' } },
  statusEvents: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

export type StaffOrderRecord = Prisma.OrderGetPayload<{ include: typeof staffOrderInclude }>;

export interface StaffOrderItemView {
  productId: string;
  sku: string;
  barcode: string | null;
  name: string;
  quantity: number;
  image: ImageUrls | null;
}

/** Lo que ve el personal de la sucursal: qué preparar y para quién. Sin costos ni datos de pago. */
export interface StaffOrderView {
  id: string;
  number: number;
  status: StaffOrderRecord['status'];
  deliveryMethod: StaffOrderRecord['deliveryMethod'];
  branch: { id: string; name: string };
  customer: { name: string; phone: string | null; businessName: string | null };
  shippingAddress: string | null;
  note: string | null;
  items: StaffOrderItemView[];
  units: number;
  total: string;
  paidAt: Date | null;
  createdAt: Date;
  /** Desde cuándo está en el estado actual (para destacar lo que lleva demasiado). */
  statusSince: Date;
  history: { status: StaffOrderRecord['status']; at: Date }[];
  actions: OrderActions;
}

export function toStaffOrderView(order: StaffOrderRecord, imageUrls: (key: string | null) => ImageUrls | null): StaffOrderView {
  const history = order.statusEvents.map((event) => ({ status: event.toStatus, at: event.createdAt }));
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    deliveryMethod: order.deliveryMethod,
    branch: order.branch,
    customer: { name: order.customer.fullName, phone: order.customer.phone, businessName: order.customer.businessName },
    shippingAddress: order.shippingAddress,
    note: order.note,
    items: order.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      barcode: item.product.barcode,
      name: item.name,
      quantity: item.quantity,
      image: imageUrls(item.product.imageKey),
    })),
    units: order.items.reduce((total, item) => total + item.quantity, 0),
    total: order.total.toFixed(2),
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    statusSince: history.at(-1)?.at ?? order.updatedAt,
    history,
    actions: actionsFor(order.status, order.deliveryMethod),
  };
}
