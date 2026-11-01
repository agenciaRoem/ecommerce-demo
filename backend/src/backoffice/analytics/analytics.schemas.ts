import { z } from 'zod';
import { dateRangeSchema } from './date-range';

export const overviewSchema = dateRangeSchema.extend({
  /** Cómo se ordenan los productos más vendidos. */
  rank: z.enum(['revenue', 'units']).default('revenue'),
});

export const lowStockSchema = z.object({
  /** Se listan los productos con esta cantidad disponible o menos. */
  threshold: z.coerce.number().int().min(0).max(1000).default(5),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type OverviewQuery = z.infer<typeof overviewSchema>;
export type LowStockQuery = z.infer<typeof lowStockSchema>;
