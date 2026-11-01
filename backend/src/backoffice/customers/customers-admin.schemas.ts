import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { plainText, searchText } from '../../common/text';

export const listCommerceSchema = paginationSchema.extend({
  search: searchText().optional(),
  /** `pending`: comercios que todavía esperan aprobación. */
  status: z.enum(['pending', 'verified', 'all']).default('pending'),
});

export const verifyCuitSchema = z.object({
  verified: z.boolean(),
  /** Con qué se comprobó (p. ej. "constancia de ARCA del 12/11"). Queda en la auditoría. */
  note: plainText(3, 200),
});

export const customerIdSchema = z.string().uuid();

export type ListCommerceQuery = z.infer<typeof listCommerceSchema>;
export type VerifyCuitDto = z.infer<typeof verifyCuitSchema>;
