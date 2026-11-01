import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaidOutcome, OrderLifecycleService } from '../orders/lifecycle/order-lifecycle.service';
import { GatewayCredentials, GatewayError, GatewayPayment } from './gateways/payment-gateway';
import { MercadoPagoGateway } from './gateways/mercadopago.gateway';
import { PaymentSettingsService } from './payment-settings.service';

export type ReconcileResult = PaidOutcome | 'amount_mismatch' | 'in_progress' | 'ignored';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENCY = 'ARS';

const toCents = (amount: number | string) => Math.round(Number(amount) * 100);

/**
 * Cierra el círculo entre un pago de Mercado Pago y un pedido nuestro. Nada de lo que llega por la red se
 * toma como cierto: se vuelve a consultar el pago a Mercado Pago con nuestras credenciales y se comprueba
 * a qué pedido pertenece y que el importe coincida antes de dar el pedido por pagado.
 */
@Injectable()
export class PaymentReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PaymentSettingsService,
    private readonly mercadoPago: MercadoPagoGateway,
    private readonly lifecycle: OrderLifecycleService,
    private readonly cart: CartService,
  ) {}

  /** A partir del número de pago que informa un aviso. */
  async reconcilePaymentId(paymentId: string): Promise<ReconcileResult> {
    const credentials = await this.credentials();
    const payment = await this.guard(() => this.mercadoPago.getPayment(credentials, paymentId));
    return payment ? this.apply(payment) : 'ignored';
  }

  /**
   * A partir de un pedido, cuando el cliente vuelve del pago o el aviso no llegó. Con `paymentId` consulta ese
   * pago; sin él, busca los pagos del pedido y toma el aprobado (o el más reciente).
   */
  async reconcileOrder(orderId: string, paymentId?: string): Promise<ReconcileResult> {
    const credentials = await this.credentials();

    const payments = paymentId
      ? [await this.guard(() => this.mercadoPago.getPayment(credentials, paymentId))]
      : await this.guard(() => this.mercadoPago.searchPayments(credentials, orderId));

    const ofThisOrder = (payments ?? []).filter((payment): payment is GatewayPayment => payment?.reference === orderId);
    const chosen = ofThisOrder.find((payment) => payment.status === 'approved') ?? ofThisOrder[0];
    return chosen ? this.apply(chosen) : 'ignored';
  }

  async apply(payment: GatewayPayment): Promise<ReconcileResult> {
    const orderId = payment.reference;
    if (!orderId || !UUID.test(orderId)) return 'ignored'; // un pago que no es de un pedido nuestro

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, total: true, customerId: true } });
    if (!order) return 'ignored';

    if (payment.status !== 'approved') {
      await this.lifecycle.recordPaymentStatus(order.id, payment.status);
      return 'in_progress';
    }

    if (toCents(payment.amount) !== toCents(order.total.toString()) || (payment.currency && payment.currency !== CURRENCY)) {
      await this.lifecycle.flagPaymentIssue(
        order.id,
        `El importe pagado (${payment.amount} ${payment.currency ?? ''}) no coincide con el del pedido (${order.total}). No se marcó como pagado.`,
      );
      return 'amount_mismatch';
    }
    const outcome = await this.lifecycle.markPaid(order.id, { id: payment.id, status: payment.status });
    if (outcome === 'paid' || outcome === 'paid_late') await this.emptyCartOf(order);
    return outcome;
  }

  /** Lo comprado sale del carrito; lo que el cliente agregó mientras pagaba se conserva. */
  private async emptyCartOf(order: { id: string; customerId: string }): Promise<void> {
    const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id }, select: { productId: true, quantity: true } });
    await this.cart.consume(order.customerId, items);
  }

  private async credentials(): Promise<GatewayCredentials> {
    const credentials = await this.settings.getCredentials();
    if (!credentials) throw new ServiceUnavailableException('La pasarela de pago no está configurada');
    return credentials;
  }

  /**
   * Un pago que Mercado Pago no conoce (p. ej. el aviso de prueba de su panel) se ignora; un corte o
   * credenciales rotas se informan como error para que Mercado Pago reintente el aviso más tarde.
   */
  private async guard<T>(call: () => Promise<T>): Promise<T | null> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof GatewayError && error.kind === 'rejected') return null;
      if (error instanceof GatewayError) throw new ServiceUnavailableException('No se pudo consultar el pago en Mercado Pago');
      throw error;
    }
  }
}
