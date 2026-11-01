/** Variantes que se generan de cada imagen. Agregar una acá la hace disponible en toda la app. */
export const IMAGE_VARIANTS = {
  thumb: 200,
  card: 600,
  detail: 1200,
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

export const IMAGE_VARIANT_NAMES = Object.keys(IMAGE_VARIANTS) as ImageVariant[];

export const variantKey = (baseKey: string, variant: ImageVariant) => `${baseKey}/${variant}.webp`;

/** Formato de las claves que emite la API: evita que un cliente referencie rutas arbitrarias. */
export const IMAGE_KEY_PATTERN = /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
