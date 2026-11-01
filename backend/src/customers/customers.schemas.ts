import { z } from 'zod';
import { isValidCuit, normalizeCuit } from '../common/cuit';
import { plainText } from '../common/text';

const email = z.string().trim().toLowerCase().email().max(254);
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{6,20}$/, 'Teléfono inválido')
  .optional();

const common = {
  email,
  password: z.string().min(10, 'Mínimo 10 caracteres').max(128),
  fullName: plainText(2, 120),
  phone,
};

const retailSchema = z.object({ type: z.literal('RETAIL'), ...common });

const commerceSchema = z.object({
  type: z.literal('COMMERCE'),
  ...common,
  businessName: plainText(2, 160),
  cuit: z
    .string()
    .refine(isValidCuit, 'CUIT inválido')
    .transform(normalizeCuit),
  shippingAddress: plainText(5, 200).optional(),
});

export const registerCustomerSchema = z.discriminatedUnion('type', [retailSchema, commerceSchema]);

export const customerLoginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export type RegisterCustomerDto = z.infer<typeof registerCustomerSchema>;
export type CustomerLoginDto = z.infer<typeof customerLoginSchema>;
