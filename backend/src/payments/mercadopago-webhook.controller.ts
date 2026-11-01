import { Body, Controller, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PaymentWebhooksService } from './payment-webhooks.service';

const first = (value: unknown): string | undefined => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.length <= 200 ? candidate : undefined;
};

/**
 * URL que se pega en Mercado Pago (Webhooks). Es pública por naturaleza: la protege la firma de cada aviso,
 * no la sesión. Responde 200 a los avisos válidos para que Mercado Pago no los reintente.
 */
@Public()
// Mercado Pago reintenta desde muchas IPs; el límite lo pone la firma, no la tasa.
@SkipThrottle()
@Controller('payments/webhooks')
export class MercadoPagoWebhookController {
  constructor(private readonly webhooks: PaymentWebhooksService) {}

  @Post('mercadopago')
  @HttpCode(200)
  async receive(
    @Query() query: Record<string, unknown>,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Body() body: unknown,
  ) {
    await this.webhooks.receive({
      dataId: first(query['data.id']),
      type: first(query.type),
      signature,
      requestId,
      body,
    });
    return { received: true };
  }
}
