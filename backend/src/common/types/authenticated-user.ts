import type { CustomerType, RoleName } from '@prisma/client';

/** Identidad mínima que viaja en el access token y se adjunta a `request.user`. */
export interface AuthenticatedUser {
  id: string;
  role: RoleName;
  /** `null` solo para SUPERADMIN (alcance global). */
  branchId: string | null;
  /** Cuándo se emitió el access token (segundos). */
  issuedAt?: number;
}

/** Cliente de la tienda, adjunto a `request.customer`. */
export interface AuthenticatedCustomer {
  id: string;
  type: CustomerType;
  /** Comercio con CUIT aprobado: único caso en que ve precios mayoristas. */
  verified: boolean;
  /** Cuándo se emitió el access token (segundos). */
  issuedAt?: number;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
  customer?: AuthenticatedCustomer;
  query: Record<string, unknown>;
}
