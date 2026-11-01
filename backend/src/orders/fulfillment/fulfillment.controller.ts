import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { BranchScope } from '../../common/branch-scope';
import { CurrentBranchScope, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { FulfillmentService } from './fulfillment.service';
import { ListBranchOrdersQuery, TransitionDto, listBranchOrdersSchema, orderIdSchema, transitionSchema } from './fulfillment.schemas';

/**
 * Pedidos de la sucursal del empleado (SALA, y GERENTE de esa sucursal). El SUPERADMIN ve todas las sucursales
 * o filtra con `?branchId=`. El panel consulta cada pocos segundos, de ahí el límite de tasa holgado:
 * todos los empleados de un local comparten la misma IP.
 */
@Roles('SALA', 'GERENTE')
@Throttle({ default: { limit: 300, ttl: 60_000 } })
@Controller('branch/orders')
export class FulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Get('summary')
  summary(@CurrentBranchScope() scope: BranchScope) {
    return this.fulfillment.summary(scope);
  }

  @Get()
  list(@CurrentBranchScope() scope: BranchScope, @Query(new ZodValidationPipe(listBranchOrdersSchema)) query: ListBranchOrdersQuery) {
    return this.fulfillment.list(scope, query);
  }

  @Get(':id')
  get(@CurrentBranchScope() scope: BranchScope, @Param('id', new ZodValidationPipe(orderIdSchema)) id: string) {
    return this.fulfillment.get(scope, id);
  }

  @Post(':id/status')
  @HttpCode(200)
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Param('id', new ZodValidationPipe(orderIdSchema)) id: string,
    @Body(new ZodValidationPipe(transitionSchema)) body: TransitionDto,
  ) {
    return this.fulfillment.transition(scope, user.id, id, body.status);
  }
}
