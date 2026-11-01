import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectConfig } from '../../config/config.module';
import { Env } from '../../config/env.validation';
import {
  CheckoutRequest,
  CheckoutSession,
  GatewayAccount,
  GatewayCredentials,
  GatewayError,
  GatewayPayment,
  PaymentGatewayClient,
} from './payment-gateway';

const TIMEOUT_MS = 10_000;
const CURRENCY = 'ARS';

interface MercadoPagoUser {
  id: number | string;
  nickname?: string;
  email?: string;
  site_id?: string;
}

interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

interface MercadoPagoPayment {
  id: number | string;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id?: string | null;
}

/** Adaptador de Mercado Pago (Checkout Pro). El Access Token nunca se escribe en logs ni en mensajes de error. */
@Injectable()
export class MercadoPagoGateway implements PaymentGatewayClient {
  constructor(@InjectConfig() private readonly config: Env) {}

  async verifyCredentials(credentials: GatewayCredentials): Promise<GatewayAccount> {
    const user = await this.request<MercadoPagoUser>(credentials, 'GET', '/users/me');
    return {
      id: String(user.id),
      label: user.nickname ?? user.email ?? String(user.id),
      siteId: user.site_id ?? null,
    };
  }

  async createCheckout(credentials: GatewayCredentials, request: CheckoutRequest): Promise<CheckoutSession> {
    const preference = await this.request<MercadoPagoPreference>(
      credentials,
      'POST',
      '/checkout/preferences',
      {
        items: request.items.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: CURRENCY,
        })),
        external_reference: request.reference,
        ...(request.payerEmail && { payer: { email: request.payerEmail } }),
        back_urls: { success: request.successUrl, pending: request.pendingUrl, failure: request.failureUrl },
        // Mercado Pago rechaza el regreso automático si la URL de éxito no es pública y segura.
        ...(request.successUrl.startsWith('https://') && { auto_return: 'approved' }),
        notification_url: request.notificationUrl,
        // El stock se reserva por un plazo corto: un pago en efectivo (cupón, cajero) puede acreditarse días después,
        // cuando la reserva ya venció. Solo se ofrecen medios que confirman en el momento.
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
        ...(request.expiresAt && { expires: true, expiration_date_to: request.expiresAt.toISOString() }),
      },
      // Mismo pedido reintentado = misma preferencia, no un cobro duplicado.
      request.reference,
    );

    const sandbox = credentials.mode === 'SANDBOX';
    return { id: preference.id, url: sandbox ? (preference.sandbox_init_point ?? preference.init_point) : preference.init_point };
  }

  async getPayment(credentials: GatewayCredentials, paymentId: string): Promise<GatewayPayment> {
    const payment = await this.request<MercadoPagoPayment>(credentials, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`);
    return this.toPayment(payment);
  }

  async searchPayments(credentials: GatewayCredentials, reference: string): Promise<GatewayPayment[]> {
    const query = new URLSearchParams({ external_reference: reference, sort: 'date_created', criteria: 'desc', limit: '10' });
    const { results } = await this.request<{ results?: MercadoPagoPayment[] }>(credentials, 'GET', `/v1/payments/search?${query}`);
    return (results ?? []).map((payment) => this.toPayment(payment));
  }

  private toPayment(payment: MercadoPagoPayment): GatewayPayment {
    return {
      id: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail ?? null,
      reference: payment.external_reference ?? null,
      amount: payment.transaction_amount,
      currency: payment.currency_id ?? null,
    };
  }

  private async request<T>(
    credentials: GatewayCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.config.MERCADOPAGO_API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          ...(method === 'POST' && { 'X-Idempotency-Key': idempotencyKey ?? randomUUID() }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new GatewayError('No se pudo comunicar con Mercado Pago', 'unavailable');
    }

    if (response.status === 401 || response.status === 403) {
      throw new GatewayError('Mercado Pago rechazó las credenciales', 'invalid_credentials');
    }
    if (response.status >= 500) {
      throw new GatewayError('Mercado Pago no está disponible en este momento', 'unavailable');
    }
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as { message?: unknown } | null;
      throw new GatewayError(typeof detail?.message === 'string' ? detail.message : 'Mercado Pago rechazó la solicitud', 'rejected');
    }
    return (await response.json()) as T;
  }
}
