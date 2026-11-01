import { z } from 'zod';

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

/** URL sin barra final, con un valor por defecto. */
const publicUrl = (fallback: string) =>
  z
    .string()
    .url()
    .default(fallback)
    .transform((url) => url.replace(/\/+$/, ''));

const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);

/** Palabras que delatan una clave copiada de un ejemplo o de un tutorial. */
const PLACEHOLDER_SECRET = /change|cambia|example|ejemplo|placeholder|your[-_ ]|dev[-_]|test/i;

/** Variable opcional: vacía (como la pasa Docker Compose cuando no se define) equivale a no estar. */
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),

    CORS_ORIGINS: csv.default(['http://localhost:3000']),
    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().min(1).optional(),
    // Cuántos proxies hay delante del backend (Caddy = 1, Cloudflare + Caddy = 2). 0 = ninguno.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

    // Almacenamiento de imágenes. Para sumar un proveedor (S3/R2/MinIO) basta un nuevo valor y su adaptador.
    STORAGE_DRIVER: z.enum(['local']).default('local'),
    MEDIA_DIR: z.string().min(1).default('./uploads'),
    MEDIA_PUBLIC_URL: z
      .string()
      .url()
      .default('http://localhost:4000/media')
      .transform((url) => url.replace(/\/+$/, '')),

    // Cifra los secretos guardados desde el backoffice (credenciales de pasarelas). 32 bytes en base64.
    // Si se pierde, esos secretos no se pueden descifrar y hay que volver a cargarlos.
    SETTINGS_ENCRYPTION_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, 'Debe tener 32 bytes en base64 (openssl rand -base64 32)'),

    // URLs públicas: Mercado Pago las usa para avisar pagos (webhook) y devolver al cliente a la tienda.
    PUBLIC_API_URL: publicUrl('http://localhost:4000'),
    PUBLIC_STORE_URL: publicUrl('http://localhost:3000'),
    // Solo cambia en pruebas (servidor simulado).
    MERCADOPAGO_API_URL: publicUrl('https://api.mercadopago.com'),

    // Zona horaria del negocio: define qué es "hoy" y a qué día pertenece cada venta en las métricas.
    BUSINESS_TIMEZONE: z
      .string()
      .default('America/Argentina/Buenos_Aires')
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone });
          return true;
        } catch {
          return false;
        }
      }, 'Zona horaria inválida (ej. America/Argentina/Buenos_Aires)'),

    // Correo saliente (verificación de email y recuperación de contraseña).
    //  smtp   = envío real (obligatorio en producción)
    //  log    = no envía: escribe el mensaje, con sus enlaces, en el log del backend (desarrollo)
    //  memory = guarda los mensajes en memoria (pruebas automáticas)
    MAIL_DRIVER: z.enum(['smtp', 'log', 'memory']).default('log'),
    MAIL_FROM: z.string().min(3).default('ROEM-edemo <no-reply@localhost>'),
    SMTP_HOST: optionalText,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    // true = TLS desde el inicio (puerto 465). false = STARTTLS cuando el servidor lo ofrece (puerto 587).
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: optionalText,
    SMTP_PASS: optionalText,
    // Nombre del negocio en los correos.
    STORE_NAME: z.string().min(1).max(60).default('ROEM-edemo'),
    // Si es true, un cliente tiene que verificar su email antes de poder comprar.
    REQUIRE_VERIFIED_EMAIL: booleanString.default(true),

    // Ingreso con Google (opcional: sin credenciales el botón no aparece). Crear el cliente OAuth en
    // console.cloud.google.com con la redirección  <PUBLIC_API_URL>/customers/auth/google/callback
    GOOGLE_CLIENT_ID: optionalText,
    GOOGLE_CLIENT_SECRET: optionalText,
    // Solo cambian en pruebas (servidor simulado).
    GOOGLE_AUTH_URL: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
    GOOGLE_TOKEN_URL: z.string().url().default('https://oauth2.googleapis.com/token'),

    // Cuánto tiene el cliente para pagar antes de que el stock reservado vuelva a estar disponible.
    ORDER_PAYMENT_WINDOW_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
    // Cada cuánto se buscan pedidos vencidos para liberar su reserva.
    ORDER_EXPIRY_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),

    // Márgenes con los que se calculan los precios iniciales a partir del costo (un gerente los ajusta luego).
    DEFAULT_RETAIL_MARGIN_PERCENT: z.coerce.number().min(0).max(1000).default(50),
    DEFAULT_WHOLESALE_MARGIN_PERCENT: z.coerce.number().min(0).max(1000).default(25),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos',
    path: ['JWT_REFRESH_SECRET'],
  })
  .superRefine((env, ctx) => {
    // Las credenciales de Google van juntas: con una sola, el ingreso fallaría recién cuando alguien lo use.
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_SECRET'], message: 'GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET se definen juntos' });
    }
    if (env.MAIL_DRIVER === 'smtp' && !env.SMTP_HOST) ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'MAIL_DRIVER=smtp necesita SMTP_HOST' });
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) ctx.addIssue({ code: 'custom', path: ['SMTP_PASS'], message: 'SMTP_USER y SMTP_PASS se definen juntos' });
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production' || isLocalUrl(env.PUBLIC_STORE_URL)) return;

    // Con una tienda en un dominio real se exige lo mínimo para no exponer sesiones ni claves por error.
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    for (const key of ['PUBLIC_STORE_URL', 'PUBLIC_API_URL', 'MEDIA_PUBLIC_URL'] as const) {
      if (!env[key].startsWith('https://')) issue(key, 'En producción tiene que ser https');
    }
    if (env.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) issue('CORS_ORIGINS', 'En producción todos los orígenes tienen que ser https');
    if (env.MAIL_DRIVER !== 'smtp') issue('MAIL_DRIVER', 'En producción el correo tiene que enviarse de verdad (MAIL_DRIVER=smtp): sin él nadie puede verificar su email ni recuperar su contraseña');
    if (env.COOKIE_SECURE === false) issue('COOKIE_SECURE', 'En producción las cookies tienen que ser Secure');
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (PLACEHOLDER_SECRET.test(env[key])) issue(key, 'Parece un valor de ejemplo: generá uno propio (openssl rand -base64 48)');
    }
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Variables de entorno inválidas: ${issues}`);
  }
  return parsed.data;
}
