import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerOnly } from '../common/decorators/audience.decorator';
import { CurrentCustomer } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { CheckoutService } from './checkout.service';
import { OrdersService } from './orders.service';
import {
  CheckoutDto,
  ListOrdersQuery,
  SyncOrderDto,
  checkoutSchema,
  listOrdersSchema,
  orderIdSchema,
  syncOrderSchema,
} from './orders.schemas';

/** Compra y pedidos del cliente con sesión. */
@CustomerOnly()
@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Get('checkout/options')
  options(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.checkout.options(customer);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  @HttpCode(201)
  start(@CurrentCustomer() customer: AuthenticatedCustomer, @Body(new ZodValidationPipe(checkoutSchema)) body: CheckoutDto) {
    return this.checkout.checkout(customer, body);
  }

  @Get('orders')
  list(@CurrentCustomer() customer: AuthenticatedCustomer, @Query(new ZodValidationPipe(listOrdersSchema)) query: ListOrdersQuery) {
    return this.orders.list(customer, query);
  }

  @Get('orders/:id')
  get(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', new ZodValidationPipe(orderIdSchema)) id: string) {
    return this.orders.get(customer, id);
  }

  /** Verifica el pago con Mercado Pago al volver del checkout (el aviso puede demorar o no llegar). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('orders/:id/sync')
  @HttpCode(200)
  sync(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('id', new ZodValidationPipe(orderIdSchema)) id: string,
    @Body(new ZodValidationPipe(syncOrderSchema)) body: SyncOrderDto,
  ) {
    return this.orders.sync(customer, id, body.paymentId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentCustomer() customer: AuthenticatedCustomer, @Param('id', new ZodValidationPipe(orderIdSchema)) id: string) {
    return this.orders.cancel(customer, id);
  }
}
