import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditAdminController } from './audit/audit-admin.controller';
import { AuditAdminService } from './audit/audit-admin.service';
import { BranchesAdminController } from './branches/branches-admin.controller';
import { BranchesAdminService } from './branches/branches-admin.service';
import { AbandonedCartsController } from './carts/abandoned-carts.controller';
import { AbandonedCartsService } from './carts/abandoned-carts.service';
import { CustomersAdminController } from './customers/customers-admin.controller';
import { CustomersAdminService } from './customers/customers-admin.service';
import { PaymentIssuesController } from './payment-issues/payment-issues.controller';
import { PaymentIssuesService } from './payment-issues/payment-issues.service';
import { PricingAdminController } from './pricing/pricing-admin.controller';
import { PricingAdminService } from './pricing/pricing-admin.service';
import { PromotionsAdminController } from './promotions/promotions-admin.controller';
import { PromotionsAdminService } from './promotions/promotions-admin.service';
import { StaffAdminController } from './staff/staff-admin.controller';
import { StaffAdminService } from './staff/staff-admin.service';

/**
 * Backoffice de gerencia (métricas, precios, promociones, carritos) y de administración (sucursales, personal,
 * auditoría, aprobación de comercios, pagos a revisar). Cada controlador declara su rol; el aislamiento por
 * sucursal viene de `@CurrentBranchScope()`.
 */
@Module({
  imports: [AuthModule, CartModule],
  controllers: [
    AnalyticsController,
    AbandonedCartsController,
    PricingAdminController,
    PromotionsAdminController,
    BranchesAdminController,
    StaffAdminController,
    AuditAdminController,
    CustomersAdminController,
    PaymentIssuesController,
  ],
  providers: [
    AnalyticsService,
    AbandonedCartsService,
    PricingAdminService,
    PromotionsAdminService,
    BranchesAdminService,
    StaffAdminService,
    AuditAdminService,
    CustomersAdminService,
    PaymentIssuesService,
  ],
})
export class BackofficeModule {}
