/** Quién se autentica: el personal (panel interno) o un cliente de la tienda. Cada uno tiene su propia sesión. */
export type Audience = 'staff' | 'customer';

export const COOKIES = {
  staff: { access: 'access_token', refresh: 'refresh_token', refreshPath: '/auth' },
  /** El refresh token solo viaja a los endpoints de autenticación de su propia audiencia. */
  customer: { access: 'customer_access_token', refresh: 'customer_refresh_token', refreshPath: '/customers/auth' },
} as const satisfies Record<Audience, { access: string; refresh: string; refreshPath: string }>;
