import { z } from 'zod';
import { plainText } from '../../common/text';

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,20}$/, 'Teléfono inválido');

export const createBranchSchema = z.object({
  name: plainText(2, 80),
  /** Sigla corta y fija (aparece en reportes y etiquetas). No se puede cambiar después. */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, 'De 2 a 6 letras o números'),
  address: plainText(5, 200),
  phone: phone.optional(),
});

export const updateBranchSchema = z
  .object({
    name: plainText(2, 80).optional(),
    address: plainText(5, 200).optional(),
    /** `null` borra el teléfono. */
    phone: phone.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'No hay nada para cambiar');

export const branchIdSchema = z.string().uuid();

export type CreateBranchDto = z.infer<typeof createBranchSchema>;
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
