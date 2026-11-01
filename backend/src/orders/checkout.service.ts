import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CustomerType, Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { CustomerPricingService } from '../catalog/customer-pricing.service';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { StockReservationService } from '../inventory/stock-reservation.service';
import { MercadoPagoGateway } from '../payments/gateways/mercadopago.gateway';
import { PaymentSettingsService } from '../payments/payment-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderLifecycleService } from './lifecycle/order-lifecycle.service';
import { OrderView } from './order.view';
import { OrdersService } from './orders.service';
import type { CheckoutDto } from './orders.schemas';

export type DeliveryMethodName = 'PICKUP' | 'SHIPPING';

export interface CheckoutOptions {
  paymentsEnabled: boolean;
  /** La pasarela está en modo prueba: no se cobra dinero real. */
  testMode: boolean;
  /** Minoristas: solo retiro. Comercios: retiro o envío. */
  deliveryMethods: DeliveryMethodName[];
  /** Dirección guardada en la cuenta, para sugerirla en el envío. */
  shippingAddress: string | null;
  /** Falta confirmar el email para poder comprar (si la tienda lo exige). */
  emailVerificationRequired: boolean;
  email: string;
}

export interface CheckoutResult {
  order: OrderView;
  /** A dónde mandar al cliente para que pague. */
  checkoutUrl: string;
}

/** Cuánto se cobra de envío: por ahora se coordina con la sucursal y no se suma al pedido. */
const SHIPPING_COST = new Prisma.Decimal(0);

const deliveryMethodsFor = (type: CustomerType): DeliveryMethodName[] => (type === 'COMMERCE' ? ['PICKUP', 'SHIPPING'] : ['PICKUP']);

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly pricing: CustomerPricingService,
    private readonly reservations: StockReservationService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly settings: PaymentSettingsService,
    private readonly mercadoPago: MercadoPagoGateway,
    private readonly orders: OrdersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  async options(customer: AuthenticatedCustomer): Promise<CheckoutOptions> {
    const [profile, gateway] = await Promise.all([this.profile(customer.id), this.settings.getActive()]);
    return {
      paymentsEnabled: gateway !== null,
      testMode: gateway?.mode === 'SANDBOX',
      deliveryMethods: deliveryMethodsFor(profile.type),
      shippingAddress: profile.shippingAddress,
      emailVerificationRequired: this.config.REQUIRE_VERIFIED_EMAIL && !profile.emailVerified,
      email: profile.email,
    };
  }

  /**
   * Convierte el carrito en un pedido pendiente de pago:
   *   1. en UNA transacción: reemplaza el pedido pendiente anterior, recalcula precios, reserva el stock
   *      y crea el pedido (todo o nada);
   *   2. fuera de ella, crea el cobro en Mercado Pago. Si falla, cancela el pedido y libera la reserva.
   * El stock recién sale del estante cuando el pago se aprueba.
   */
  async checkout(customer: AuthenticatedCustomer, dto: CheckoutDto): Promise<CheckoutResult> {
    const gateway = await this.settings.getActive();
    if (!gateway) throw new ConflictException('Los pagos no están disponibles por el momento. Probá de nuevo más tarde.');

    const profile = await this.profile(customer.id);
    if (this.config.REQUIRE_VERIFIED_EMAIL && !profile.emailVerified) {
      throw new ForbiddenException({ message: 'Confirmá tu email para poder comprar. Te mandamos un enlace al registrarte.', code: 'email_not_verified' });
    }
    if (!deliveryMethodsFor(profile.type).includes(dto.deliveryMethod)) {
      throw new ForbiddenException('Las cuentas de particulares retiran en sucursal: el envío a domicilio es para comercios.');
    }
    const shippingAddress = dto.deliveryMethod === 'SHIPPING' ? (dto.shippingAddress ?? profile.shippingAddress) : null;
    if (dto.deliveryMethod === 'SHIPPING' && !shippingAddress) {
      throw new BadRequestException('Indicá la dirección de entrega para el envío.');
    }

    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, isActive: true }, select: { id: true } });
    if (!branch) throw new BadRequestException('La sucursal elegida no existe o no está disponible.');

    const lines = await this.cart.lines(customer.id);
    if (lines.length === 0) throw new BadRequestException('Tu carrito está vacío.');

    const expiresAt = new Date(Date.now() + this.config.ORDER_PAYMENT_WINDOW_MINUTES * 60_000);
    const order = await this.createReservedOrder(customer, dto, lines, shippingAddress, expiresAt);

    try {
      const session = await this.mercadoPago.createCheckout(gateway, {
        reference: order.id,
        items: order.items.map((item) => ({
          id: item.productId,
          title: item.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice.sub(item.discountAmount).toFixed(2)),
        })),
        // En pruebas, Mercado Pago exige usuarios de prueba: no se le pasa el email real del cliente.
        payerEmail: gateway.mode === 'PRODUCTION' ? profile.email : undefined,
        successUrl: this.returnUrl(order.id),
        pendingUrl: this.returnUrl(order.id),
        failureUrl: this.returnUrl(order.id),
        notificationUrl: `${this.config.PUBLIC_API_URL}/payments/webhooks/mercadopago`,
        expiresAt,
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentProvider: 'MERCADOPAGO', checkoutId: session.id, checkoutUrl: session.url },
      });
      return { order: await this.orders.get(customer, order.id), checkoutUrl: session.url };
    } catch (error) {
      // Sin cobro no hay pedido: se devuelve el stock reservado.
      this.logger.error(`No se pudo crear el cobro del pedido ${order.id}: ${(error as Error).message}`);
      await this.lifecycle.cancel(order.id, 'payment_unavailable').catch(() => undefined);
      throw new ServiceUnavailableException('No pudimos iniciar el pago. Tu carrito sigue intacto: probá de nuevo en unos minutos.');
    }
  }

  private async createReservedOrder(
    customer: AuthenticatedCustomer,
    dto: CheckoutDto,
    lines: readonly { productId: string; quantity: number }[],
    shippingAddress: string | null,
    expiresAt: Date,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        // Un solo pedido pendiente por cliente: el anterior se cancela y devuelve su stock.
        const previous = await tx.order.findMany({ where: { customerId: customer.id, status: 'PENDING_PAYMENT' }, select: { id: true } });
        for (const { id } of previous) await this.lifecycle.cancelInTransaction(tx, id, 'replaced');

        const products = await tx.product.findMany({
          where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
          select: { id: true, sku: true, name: true, categoryId: true, retailPrice: true, wholesalePrice: true },
        });
        const byId = new Map(products.map((product) => [product.id, product]));
        if (products.length !== lines.length) {
          throw new ConflictException('Algún producto de tu carrito ya no está a la venta. Revisá el carrito.');
        }

        const shortages = await this.reservations.reserve(tx, dto.branchId, lines);
        if (shortages.length > 0) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: 'La sucursal no tiene stock suficiente de algunos productos.',
            shortages: shortages.map((s) => ({ productId: s.productId, name: byId.get(s.productId)?.name ?? '', requested: s.quantity, available: s.available })),
          });
        }

        // Los precios los fija el servidor, con la lista y las promociones del cliente y de la sucursal.
        const prices = await this.pricing.priceProducts(customer, products, dto.branchId);
        const items = lines.map(({ productId, quantity }) => {
          const product = byId.get(productId)!;
          const price = prices.get(productId)!;
          return {
            productId,
            sku: product.sku,
            name: product.name,
            quantity,
            unitPrice: price.listPrice,
            discountAmount: price.discountAmount,
            promotionId: price.promotionId,
            lineTotal: price.finalPrice.mul(quantity),
          };
        });
        const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));

        return tx.order.create({
          data: {
            customerId: customer.id,
            branchId: dto.branchId,
            status: 'PENDING_PAYMENT',
            deliveryMethod: dto.deliveryMethod,
            shippingAddress,
            note: dto.note,
            subtotal,
            shippingCost: SHIPPING_COST,
            total: subtotal.add(SHIPPING_COST),
            expiresAt,
            items: { create: items.map(({ lineTotal: _lineTotal, ...item }) => item) },
            statusEvents: { create: { fromStatus: null, toStatus: 'PENDING_PAYMENT' } },
          },
          include: { items: true },
        });
      },
      { maxWait: 5_000, timeout: 15_000 },
    );
  }

  private async profile(customerId: string) {
    const profile = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { type: true, email: true, shippingAddress: true, isActive: true, emailVerifiedAt: true },
    });
    if (!profile?.isActive) throw new NotFoundException('Cuenta no encontrada');
    return { ...profile, emailVerified: profile.emailVerifiedAt !== null };
  }

  private returnUrl(orderId: string): string {
    return `${this.config.PUBLIC_STORE_URL}/pedidos/${orderId}`;
  }
}
