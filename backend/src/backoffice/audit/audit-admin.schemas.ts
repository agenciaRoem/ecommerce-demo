import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { plainText } from '../../common/text';
import { dateRangeSchema } from '../analytics/date-range';

export const listAuditSchema = paginationSchema.merge(dateRangeSchema).extend({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entity: plainText(1, 60).optional(),
  action: plainText(1, 80).optional(),
  actorId: z.string().uuid().optional(),
});
export type ListAuditQuery = z.infer<typeof listAuditSchema>;
