import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { plainText, searchText } from '../../common/text';

/** Importe con hasta 2 decimales. Llega como número JSON; el tope real lo fija `findProblem`. */
const amount = z
  .number()
  .min(0)
  .max(1_000_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Máximo 2 decimales');

export const listPricesSchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  search: searchText().optional(),
  categoryId: z.string().uuid().optional(),
  /** Por defecto solo productos a la venta. */
  includeInactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export const updatePriceSchema = z
  .object({
    cost: amount.optional(),
    retailPrice: amount.optional(),
    wholesalePrice: amount.optional(),
    note: plainText(1, 200).optional(),
  })
  .refine((value) => value.cost !== undefined || value.retailPrice !== undefined || value.wholesalePrice !== undefined, 'Indicá al menos un valor para cambiar');

const percent = (min: number, max: number) => z.number().min(min).max(max);

const changeSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('MARGIN'),
    retailMarginPercent: percent(0, 1000).optional(),
    wholesaleMarginPercent: percent(0, 1000).optional(),
  }),
  z.object({
    mode: z.literal('ADJUST_PRICES'),
    percent: percent(-90, 1000).refine((value) => value !== 0, 'El porcentaje no puede ser 0'),
    applyTo: z.enum(['RETAIL', 'WHOLESALE', 'BOTH']),
  }),
  z.object({
    mode: z.literal('ADJUST_COST'),
    percent: percent(-90, 1000).refine((value) => value !== 0, 'El porcentaje no puede ser 0'),
  }),
]);

const targetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('ALL') }),
  z.object({ scope: z.literal('CATEGORY'), categoryId: z.string().uuid() }),
  z.object({ scope: z.literal('PRODUCTS'), productIds: z.array(z.string().uuid()).min(1).max(500) }),
]);

export const bulkPriceSchema = z
  .object({
    target: targetSchema,
    change: changeSchema,
    rounding: z.enum(['NONE', 'UNIT', 'TEN', 'HUNDRED']).default('NONE'),
    note: plainText(1, 200).optional(),
  })
  .superRefine((value, ctx) => {
    const { change } = value;
    if (change.mode === 'MARGIN' && change.retailMarginPercent === undefined && change.wholesaleMarginPercent === undefined) {
      ctx.addIssue({ code: 'custom', path: ['change'], message: 'Indicá al menos un margen' });
    }
  });

export const productIdSchema = z.string().uuid();

export type ListPricesQuery = z.infer<typeof listPricesSchema>;
export type UpdatePriceDto = z.infer<typeof updatePriceSchema>;
export type BulkPriceDto = z.infer<typeof bulkPriceSchema>;
