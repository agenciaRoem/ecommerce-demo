import { z } from 'zod';
import { paginationSchema } from '../common/pagination';
import { plainText } from '../common/text';

export const checkoutSchema = z.object({
  deliveryMethod: z.enum(['PICKUP', 'SHIPPING']),
  /** Sucursal donde se retira o desde la que se despacha. */
  branchId: z.string().uuid(),
  shippingAddress: plainText(5, 200).optional(),
  note: plainText(1, 300).optional(),
});

export const listOrdersSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const syncOrderSchema = z.object({
  /** Número de pago que Mercado Pago agrega al volver (`payment_id`). Es solo una pista: se verifica con Mercado Pago. */
  paymentId: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
});

export const orderIdSchema = z.string().uuid();

export type CheckoutDto = z.infer<typeof checkoutSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
export type SyncOrderDto = z.infer<typeof syncOrderSchema>;
