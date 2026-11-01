import { z } from 'zod';
import { paginationSchema } from '../common/pagination';
import { searchText } from '../common/text';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const catalogListSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(48).default(12),
  search: searchText().optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  branchId: z.string().uuid().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  onSale: booleanString.optional(),
  inStock: booleanString.optional(),
});

export const productIdSchema = z.string().uuid();

export const branchQuerySchema = z.object({ branchId: z.string().uuid().optional() });

export type CatalogListQuery = z.infer<typeof catalogListSchema>;
export type BranchQuery = z.infer<typeof branchQuerySchema>;
