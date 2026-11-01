/**
 * Contrato que cumple cada pasarela de pago. El checkout (Fase 5) depende de esto, no de Mercado Pago:
 * sumar otra pasarela es escribir un adaptador nuevo.
 */

export type GatewayMode = 'SANDBOX' | 'PRODUCTION';

export interface GatewayCredentials {
  accessToken: string;
  mode: GatewayMode;
}

/** Cuenta del vendedor a la que pertenecen las credenciales. */
export interface GatewayAccount {
  id: string;
  label: string;
  siteId: string | null;
}

export interface CheckoutItem {
  id: string;
  title: string;
  quantity: number;
  /** Precio unitario final, en la moneda de la cuenta. */
  unitPrice: number;
}

export interface CheckoutRequest {
  /** Identificador del pedido en nuestro sistema; vuelve en las notificaciones para conciliar. */
  reference: string;
  items: CheckoutItem[];
  payerEmail?: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  notificationUrl: string;
  expiresAt?: Date;
}

export interface CheckoutSession {
  id: string;
  /** Dirección a la que se redirige al cliente para pagar. */
  url: string;
}

export interface GatewayPayment {
  id: string;
  status: string;
  statusDetail: string | null;
  reference: string | null;
  amount: number;
  currency: string | null;
}

export type GatewayErrorKind = 'invalid_credentials' | 'unavailable' | 'rejected';

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly kind: GatewayErrorKind,
  ) {
    super(message);
  }
}

export interface PaymentGatewayClient {
  /** Comprueba las credenciales contra el proveedor y devuelve la cuenta a la que pertenecen. */
  verifyCredentials(credentials: GatewayCredentials): Promise<GatewayAccount>;
  createCheckout(credentials: GatewayCredentials, request: CheckoutRequest): Promise<CheckoutSession>;
  getPayment(credentials: GatewayCredentials, paymentId: string): Promise<GatewayPayment>;
  /** Pagos asociados a un pedido, del más nuevo al más viejo. Sirve cuando el aviso (webhook) no llegó. */
  searchPayments(credentials: GatewayCredentials, reference: string): Promise<GatewayPayment[]>;
}
