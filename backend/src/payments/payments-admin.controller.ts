import { Body, Controller, Delete, Get, HttpCode, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { ListEventsQuery, UpdateGatewayDto, listEventsSchema, updateGatewaySchema } from './payments.schemas';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentWebhooksService } from './payment-webhooks.service';

/** Configuración de Mercado Pago desde el backoffice. Solo el SUPERADMIN. */
@Roles('SUPERADMIN')
@Controller('admin/payments/mercadopago')
export class PaymentsAdminController {
  constructor(
    private readonly settings: PaymentSettingsService,
    private readonly webhooks: PaymentWebhooksService,
  ) {}

  @Get()
  get() {
    return this.settings.getView();
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Put()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body(new ZodValidationPipe(updateGatewaySchema)) body: UpdateGatewayDto,
  ) {
    return this.settings.update(body, { id: user.id, ip: req.ip });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify')
  @HttpCode(200)
  verify(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.settings.verify({ id: user.id, ip: req.ip });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Delete()
  disconnect(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.settings.disconnect({ id: user.id, ip: req.ip });
  }

  @Get('events')
  events(@Query(new ZodValidationPipe(listEventsSchema)) query: ListEventsQuery) {
    return this.webhooks.listRecent(query.limit);
  }
}
