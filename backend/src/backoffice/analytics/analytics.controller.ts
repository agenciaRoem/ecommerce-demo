import { Controller, Get, Query } from '@nestjs/common';
import type { BranchScope } from '../../common/branch-scope';
import { CurrentBranchScope } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LowStockQuery, OverviewQuery, lowStockSchema, overviewSchema } from './analytics.schemas';
import { AnalyticsService } from './analytics.service';

/** Métricas de la sucursal del gerente. El SUPERADMIN ve el total o filtra con `?branchId=`. */
@Roles('GERENTE')
@Controller('backoffice/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentBranchScope() scope: BranchScope, @Query(new ZodValidationPipe(overviewSchema)) query: OverviewQuery) {
    return this.analytics.overview(scope, query);
  }

  @Get('low-stock')
  lowStock(@CurrentBranchScope() scope: BranchScope, @Query(new ZodValidationPipe(lowStockSchema)) query: LowStockQuery) {
    return this.analytics.lowStock(scope, query);
  }
}
