import { z } from 'zod';
import { paginationSchema } from '../common/pagination';
import { IMAGE_KEY_PATTERN } from '../media/image-variants';
import { MAX_MOVEMENT_QUANTITY } from '../inventory/inventory.schemas';
import { plainText, searchText } from '../common/text';

const money = z.number().positive().max(99_999_999.99);

export const createProductSchema = z.object({
  name: plainText(2, 120),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9._-]{3,40}$/, 'SKU inválido')
    .optional(),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{6,32}$/, 'Código de barras inválido')
    .optional(),
  categoryId: z.string().uuid(),
  description: plainText(1, 1000).optional(),
  cost: money,
  /** Unidades iniciales. El encargado de stock no carga stock: para él se ignora. */
  quantity: z.number().int().min(0).max(MAX_MOVEMENT_QUANTITY).default(0),
  imageKey: z.string().regex(IMAGE_KEY_PATTERN, 'Clave de imagen inválida').optional(),
});

/** Datos que se pueden corregir de un producto. Precios, costo y stock tienen sus propios circuitos. */
export const updateProductSchema = z
  .object({
    name: plainText(2, 120).optional(),
    /** `null` borra el código. */
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{6,32}$/, 'Código de barras inválido')
      .nullable()
      .optional(),
    categoryId: z.string().uuid().optional(),
    description: plainText(1, 1000).nullable().optional(),
    imageKey: z.string().regex(IMAGE_KEY_PATTERN, 'Clave de imagen inválida').optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'No hay nada para cambiar');

export const productIdSchema = z.string().uuid();

export const listProductsSchema = paginationSchema.extend({
  search: searchText().optional(),
  categoryId: z.string().uuid().optional(),
});

export const lookupProductSchema = z.object({
  code: plainText(1, 40),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsSchema>;
export type LookupProductQuery = z.infer<typeof lookupProductSchema>;
