import { z } from 'zod';

export const abandonedCartsSchema = z.object({
  /** Un carrito cuenta como abandonado si nadie lo toca desde hace esta cantidad de minutos. */
  idleMinutes: z.coerce.number().int().min(5).max(30 * 24 * 60).default(60),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AbandonedCartsQuery = z.infer<typeof abandonedCartsSchema>;
