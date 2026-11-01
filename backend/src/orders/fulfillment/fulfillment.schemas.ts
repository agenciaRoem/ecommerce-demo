import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { searchText } from '../../common/text';

export const listBranchOrdersSchema = paginationSchema.extend({
  // La cola activa se atiende completa: un tope bajo dejaría pedidos nuevos fuera de la pantalla sin que nadie lo note.
  limit: z.coerce.number().int().min(1).max(500).default(100),
  /** `active`: la cola de trabajo. `completed`: lo ya entregado. */
  view: z.enum(['active', 'completed']).default('active'),
  /** Número de pedido o nombre del cliente. */
  search: searchText().optional(),
});

export const transitionSchema = z.object({
  status: z.enum(['PENDING', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'READY_FOR_FREIGHT', 'COMPLETED']),
});

export const orderIdSchema = z.string().uuid();

export type ListBranchOrdersQuery = z.infer<typeof listBranchOrdersSchema>;
export type TransitionDto = z.infer<typeof transitionSchema>;
