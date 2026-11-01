import { z } from 'zod';

const MERCADOPAGO_KEY = /^(APP_USR|TEST)-[A-Za-z0-9_-]{20,200}$/;

const accessToken = z
  .string()
  .trim()
  .regex(MERCADOPAGO_KEY, 'El Access Token debe empezar con APP_USR- o TEST- (lo encontrás en Tus integraciones → Credenciales)');

const publicKey = z.union([
  z.literal(''), // vacío = borrar
  z
    .string()
    .trim()
    .regex(MERCADOPAGO_KEY, 'La Public Key debe empezar con APP_USR- o TEST-'),
]);

const webhookSecret = z
  .string()
  .trim()
  .min(16, 'La clave secreta del webhook es más larga: copiala completa desde Webhooks → Configurar notificaciones')
  .max(200)
  .regex(/^\S+$/, 'La clave secreta no lleva espacios');

/** Todos los campos son opcionales: un secreto que no se envía se conserva tal cual está guardado. */
export const updateGatewaySchema = z
  .object({
    mode: z.enum(['SANDBOX', 'PRODUCTION']).optional(),
    accessToken: accessToken.optional(),
    publicKey: publicKey.optional(),
    webhookSecret: webhookSecret.optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'No hay cambios para guardar');

export const listEventsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Cuerpo de una notificación de Mercado Pago. Se tolera cualquier campo extra: solo se leen estos. */
export const mercadoPagoNotificationSchema = z
  .object({
    type: z.string().max(60).optional(),
    action: z.string().max(80).optional(),
    live_mode: z.boolean().optional(),
    data: z.object({ id: z.union([z.string(), z.number()]).optional() }).partial().optional(),
  })
  .passthrough();

export type UpdateGatewayDto = z.infer<typeof updateGatewaySchema>;
export type ListEventsQuery = z.infer<typeof listEventsSchema>;
