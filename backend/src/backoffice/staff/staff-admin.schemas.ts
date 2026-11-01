import { RoleName } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { plainText, searchText } from '../../common/text';

/** Sale del enum de Prisma: un rol nuevo en el esquema queda disponible acá sin tocar otra lista. */
const roleName = z.nativeEnum(RoleName);
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, 'Mínimo 10 caracteres').max(128);

export const listStaffSchema = paginationSchema.extend({
  search: searchText().optional(),
  role: roleName.optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});

export const createStaffSchema = z
  .object({
    email,
    fullName: plainText(2, 120),
    password,
    role: roleName,
    /** Obligatoria para todos los roles salvo SUPERADMIN, que es global. */
    branchId: z.string().uuid().optional(),
  })
  .superRefine(validateRoleAndBranch);

export const updateStaffSchema = z
  .object({
    fullName: plainText(2, 120).optional(),
    role: roleName.optional(),
    branchId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'No hay nada para cambiar');

export const resetPasswordSchema = z.object({ password });

export const staffIdSchema = z.string().uuid();

/** SUPERADMIN no pertenece a una sucursal; cualquier otro rol exige una. */
function validateRoleAndBranch(value: { role: z.infer<typeof roleName>; branchId?: string | null }, ctx: z.RefinementCtx) {
  if (value.role === 'SUPERADMIN' && value.branchId) {
    ctx.addIssue({ code: 'custom', path: ['branchId'], message: 'El superadmin es global: no lleva sucursal' });
  }
  if (value.role !== 'SUPERADMIN' && !value.branchId) {
    ctx.addIssue({ code: 'custom', path: ['branchId'], message: 'Elegí la sucursal de este rol' });
  }
}

export type ListStaffQuery = z.infer<typeof listStaffSchema>;
export type CreateStaffDto = z.infer<typeof createStaffSchema>;
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;
