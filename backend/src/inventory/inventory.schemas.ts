import { z } from 'zod';
import { paginationSchema } from '../common/pagination';
import { plainText, searchText } from '../common/text';

export const MAX_MOVEMENT_QUANTITY = 100_000;

export const receiveStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_MOVEMENT_QUANTITY),
  note: plainText(1, 200).optional(),
});

export const listInventorySchema = paginationSchema.extend({
  search: searchText().optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
});

/** Motivos de un ajuste de emergencia. Quedan en la nota del movimiento para poder auditarlos. */
export const ADJUSTMENT_REASONS = {
  DAMAGED: 'Rotura o merma',
  LOST: 'Faltante',
  FOUND: 'Sobrante encontrado',
  RETURN: 'Devolución al estante',
  OTHER: 'Otro motivo',
} as const;
export type AdjustmentReason = keyof typeof ADJUSTMENT_REASONS;

export const MAX_ADJUSTMENT = 10_000;

export const adjustStockSchema = z
  .object({
    productId: z.string().uuid(),
    /** Unidades a sumar (positivo) o restar (negativo) del stock de la sucursal. */
    delta: z
      .number()
      .int()
      .min(-MAX_ADJUSTMENT)
      .max(MAX_ADJUSTMENT)
      .refine((value) => value !== 0, 'La diferencia no puede ser 0'),
    reason: z.enum(['DAMAGED', 'LOST', 'FOUND', 'RETURN', 'OTHER']),
    note: plainText(1, 200).optional(),
  })
  .superRefine((value, ctx) => {
    const removes = value.reason === 'DAMAGED' || value.reason === 'LOST';
    const adds = value.reason === 'FOUND' || value.reason === 'RETURN';
    if (removes && value.delta > 0) ctx.addIssue({ code: 'custom', path: ['delta'], message: 'Ese motivo resta unidades' });
    if (adds && value.delta < 0) ctx.addIssue({ code: 'custom', path: ['delta'], message: 'Ese motivo suma unidades' });
    if (value.reason === 'OTHER' && !value.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Contá el motivo' });
  });

export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
export type ReceiveStockDto = z.infer<typeof receiveStockSchema>;
export type ListInventoryQuery = z.infer<typeof listInventorySchema>;
