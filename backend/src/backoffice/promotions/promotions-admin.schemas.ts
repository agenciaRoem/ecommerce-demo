import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { plainText } from '../../common/text';

export const promotionFields = z.object({
  name: plainText(2, 120),
  description: plainText(1, 300).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  /** Porcentaje (0-100) o importe fijo por unidad, con hasta 2 decimales. */
  value: z
    .number()
    .positive()
    .max(100_000_000)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Máximo 2 decimales'),
  audience: z.enum(['ALL', 'RETAIL', 'COMMERCE']).default('ALL'),
  scope: z.enum(['ALL', 'CATEGORY', 'PRODUCTS']),
  categoryId: z.string().uuid().optional(),
  productIds: z.array(z.string().uuid()).max(500).optional(),
  /** Vacío = todas las sucursales (solo el superadmin). El gerente siempre queda en la suya. */
  branchId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean().default(true),
});

/** Reglas que cruzan campos: fechas, tope del porcentaje y coherencia entre alcance, categoría y productos. */
export function validatePromotion(value: z.infer<typeof promotionFields>, ctx: z.RefinementCtx): void {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) issue('endsAt', 'Tiene que terminar después de empezar');
  if (value.discountType === 'PERCENTAGE' && value.value > 100) issue('value', 'El porcentaje no puede pasar de 100');

  if (value.scope === 'CATEGORY' && !value.categoryId) issue('categoryId', 'Elegí la categoría');
  if (value.scope !== 'CATEGORY' && value.categoryId) issue('categoryId', 'Solo aplica al alcance por categoría');
  if (value.scope === 'PRODUCTS' && !value.productIds?.length) issue('productIds', 'Elegí al menos un producto');
  if (value.scope !== 'PRODUCTS' && value.productIds?.length) issue('productIds', 'Solo aplica al alcance por productos');
}

export const promotionSchema = promotionFields.superRefine(validatePromotion);

export const listPromotionsSchema = paginationSchema.extend({
  status: z.enum(['all', 'active', 'upcoming', 'ended', 'inactive']).default('all'),
});

export const promotionIdSchema = z.string().uuid();

export type PromotionDto = z.infer<typeof promotionSchema>;
export type ListPromotionsQuery = z.infer<typeof listPromotionsSchema>;
