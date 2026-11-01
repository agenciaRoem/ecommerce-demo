import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { PaymentWebhookEvent, Prisma } from '@prisma/client';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { verifyMercadoPagoSignature } from './gateways/mercadopago-signature';
import { mercadoPagoNotificationSchema } from './payments.schemas';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentSettingsService } from './payment-settings.service';

export interface MercadoPagoNotification {
  /** Parámetro `data.id` de la URL. */
  dataId: string | undefined;
  /** Parámetro `type` de la URL. */
  type: string | undefined;
  signature: string | undefined;
  requestId: string | undefined;
  body: unknown;
}

export interface WebhookEventView {
  id: string;
  topic: string;
  action: string | null;
  resourceId: string;
  liveMode: boolean | null;
  receivedAt: Date;
}

@Injectable()
export class PaymentWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PaymentSettingsService,
    private readonly reconciliation: PaymentReconciliationService,
  ) {}

  /**
   * Recibe un aviso de Mercado Pago. Solo se guarda si la firma es válida; así cualquiera que descubra la URL
   * no puede llenar la base ni simular un pago. Los avisos de pagos se concilian con el pedido: si eso falla
   * por un motivo transitorio responde error y Mercado Pago reintenta; los reintentos no duplican el evento.
   */
  async receive(notification: MercadoPagoNotification): Promise<void> {
    const secret = await this.settings.getWebhookSecret();
    if (!secret) throw new ServiceUnavailableException('Pasarela no configurada');

    const valid = verifyMercadoPagoSignature({
      secret,
      signatureHeader: notification.signature,
      requestId: notification.requestId,
      dataId: notification.dataId,
    });
    if (!valid) throw new UnauthorizedException('Firma inválida');

    const parsed = mercadoPagoNotificationSchema.safeParse(notification.body ?? {});
    const body = parsed.success ? parsed.data : {};
    const resourceId = notification.dataId ?? (body.data?.id !== undefined ? String(body.data.id) : undefined);
    if (!resourceId) return; // firmada pero sin recurso: no hay nada que registrar

    const event = await this.record({
      topic: (notification.type ?? body.type ?? 'unknown').slice(0, 60),
      action: body.action ?? null,
      resourceId: resourceId.slice(0, 80),
      requestId: notification.requestId?.slice(0, 120) ?? null,
      liveMode: body.live_mode ?? null,
      payload: (parsed.success ? body : {}) as Prisma.InputJsonValue,
    });
    if (event.processedAt) return; // reintento de un aviso que ya se atendió

    if (event.topic === 'payment') await this.reconciliation.reconcilePaymentId(event.resourceId);
    await this.prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  }

  listRecent(limit: number): Promise<WebhookEventView[]> {
    return this.prisma.paymentWebhookEvent.findMany({
      where: { provider: 'MERCADOPAGO' },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: { id: true, topic: true, action: true, resourceId: true, liveMode: true, receivedAt: true },
    });
  }

  /** Guarda el aviso, o devuelve el ya guardado si Mercado Pago lo está reintentando (mismo x-request-id). */
  private async record(data: Omit<Prisma.PaymentWebhookEventUncheckedCreateInput, 'provider'>): Promise<PaymentWebhookEvent> {
    try {
      return await this.prisma.paymentWebhookEvent.create({ data: { provider: 'MERCADOPAGO', ...data } });
    } catch (error) {
      if (!isUniqueViolation(error) || !data.requestId) throw error;
      return this.prisma.paymentWebhookEvent.findUniqueOrThrow({
        where: { provider_requestId: { provider: 'MERCADOPAGO', requestId: data.requestId } },
      });
    }
  }
}
