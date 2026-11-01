import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BulkPriceDto, ListPricesQuery, UpdatePriceDto, bulkPriceSchema, listPricesSchema, productIdSchema, updatePriceSchema } from './pricing-admin.schemas';
import { PricingAdminService } from './pricing-admin.service';

/** Precios y costos de venta (gerentes). Rigen para todas las sucursales. */
@Roles('GERENTE')
@Controller('backoffice/prices')
export class PricingAdminController {
  constructor(private readonly prices: PricingAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listPricesSchema)) query: ListPricesQuery) {
    return this.prices.list(query);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('bulk/preview')
  @HttpCode(200)
  preview(@Body(new ZodValidationPipe(bulkPriceSchema)) body: BulkPriceDto) {
    return this.prices.previewBulk(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('bulk/apply')
  @HttpCode(200)
  apply(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body(new ZodValidationPipe(bulkPriceSchema)) body: BulkPriceDto) {
    return this.prices.applyBulk(user, body, req.ip);
  }

  @Get(':productId/history')
  history(@Param('productId', new ZodValidationPipe(productIdSchema)) productId: string) {
    return this.prices.history(productId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Patch(':productId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('productId', new ZodValidationPipe(productIdSchema)) productId: string,
    @Body(new ZodValidationPipe(updatePriceSchema)) body: UpdatePriceDto,
  ) {
    return this.prices.update(user, productId, body, req.ip);
  }
}
