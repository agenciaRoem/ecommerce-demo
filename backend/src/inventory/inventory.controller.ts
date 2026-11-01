import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { BranchScope, requireBranchId } from '../common/branch-scope';
import { CurrentBranchScope, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  AdjustStockDto,
  ListInventoryQuery,
  ReceiveStockDto,
  adjustStockSchema,
  listInventorySchema,
  receiveStockSchema,
} from './inventory.schemas';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** El encargado de stock da de alta productos pero no ve ni mueve existencias. */
  @Roles('STOCKEO', 'SALA', 'GERENTE')
  @Get()
  list(
    @CurrentBranchScope() scope: BranchScope,
    @Query(new ZodValidationPipe(listInventorySchema)) query: ListInventoryQuery,
  ) {
    return this.inventory.list(scope, query);
  }

  /** Ingreso de mercadería a la sucursal del usuario. */
  @Roles('STOCKEO', 'GERENTE')
  @Post('receipts')
  @HttpCode(201)
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Body(new ZodValidationPipe(receiveStockSchema)) body: ReceiveStockDto,
  ) {
    return this.inventory.receive(user.id, requireBranchId(scope), body.productId, body.quantity, body.note);
  }

  /** Ajuste de emergencia en la estantería de la sucursal del usuario. */
  @Roles('SALA', 'GERENTE')
  @Post('adjustments')
  @HttpCode(201)
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Body(new ZodValidationPipe(adjustStockSchema)) body: AdjustStockDto,
  ) {
    return this.inventory.adjust(user.id, requireBranchId(scope), body);
  }
}
