import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomerOnly } from '../common/decorators/audience.decorator';
import { CurrentCustomer } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CartViewService } from './cart-view.service';
import {
  AddCartItemDto,
  CartViewQuery,
  SetCartItemDto,
  addCartItemSchema,
  cartViewQuerySchema,
  productParamSchema,
  setCartItemSchema,
} from './cart.schemas';
import { CartService } from './cart.service';

/** Carrito del cliente con sesión. */
@CustomerOnly()
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly view: CartViewService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  get(@CurrentCustomer() customer: AuthenticatedCustomer, @Query(new ZodValidationPipe(cartViewQuerySchema)) query: CartViewQuery) {
    return this.view.build(customer, query.branchId);
  }

  /** Solo la cantidad total, para el ícono de la cabecera: no toca la base de datos. */
  @Get('count')
  async count(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return { count: await this.cart.count(customer.id) };
  }

  @Post('items')
  @HttpCode(200)
  async add(@CurrentCustomer() customer: AuthenticatedCustomer, @Body(new ZodValidationPipe(addCartItemSchema)) body: AddCartItemDto) {
    await this.assertAvailable(body.productId);
    await this.cart.add(customer.id, body.productId, body.quantity);
    return this.view.build(customer);
  }

  @Patch('items/:productId')
  async set(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('productId', new ZodValidationPipe(productParamSchema)) productId: string,
    @Body(new ZodValidationPipe(setCartItemSchema)) body: SetCartItemDto,
  ) {
    if (body.quantity > 0) await this.assertAvailable(productId);
    await this.cart.set(customer.id, productId, body.quantity);
    return this.view.build(customer);
  }

  @Delete('items/:productId')
  async remove(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('productId', new ZodValidationPipe(productParamSchema)) productId: string,
  ) {
    await this.cart.remove(customer.id, [productId]);
    return this.view.build(customer);
  }

  @Delete()
  @HttpCode(204)
  async clear(@CurrentCustomer() customer: AuthenticatedCustomer) {
    await this.cart.clear(customer.id);
  }

  private async assertAvailable(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
    if (!product) throw new NotFoundException('El producto ya no está disponible');
  }
}
