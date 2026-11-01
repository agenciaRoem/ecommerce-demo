import { z } from 'zod';
import { plainText } from '../../common/text';

export const resolveIssueSchema = z.object({
  /** Qué se hizo (p. ej. "reembolsado en Mercado Pago el 12/11"). Queda en la auditoría. */
  note: plainText(3, 300),
});
export const orderIdSchema = z.string().uuid();
export type ResolveIssueDto = z.infer<typeof resolveIssueSchema>;
