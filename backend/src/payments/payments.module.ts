import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { OrderLifecycleModule } from '../orders/lifecycle/order-lifecycle.module';
import { MercadoPagoGateway } from './gateways/mercadopago.gateway';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentWebhooksService } from './payment-webhooks.service';
import { PaymentsAdminController } from './payments-admin.controller';

@Module({
  imports: [CartModule, OrderLifecycleModule],
  controllers: [PaymentsAdminController, MercadoPagoWebhookController],
  providers: [MercadoPagoGateway, PaymentSettingsService, PaymentWebhooksService, PaymentReconciliationService],
  // El checkout usa estas piezas: las credenciales vigentes, el adaptador de la pasarela y la conciliación de pagos.
  exports: [PaymentSettingsService, MercadoPagoGateway, PaymentReconciliationService],
})
export class PaymentsModule {}
