import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { BranchScope } from '../../common/branch-scope';
import { CurrentBranchScope, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ListPromotionsQuery, PromotionDto, listPromotionsSchema, promotionIdSchema, promotionSchema } from './promotions-admin.schemas';
import { PromotionsAdminService } from './promotions-admin.service';

/** Descuentos por evento (gerentes y superadmin). */
@Roles('GERENTE')
@Controller('backoffice/promotions')
export class PromotionsAdminController {
  constructor(private readonly promotions: PromotionsAdminService) {}

  @Get()
  list(@CurrentBranchScope() scope: BranchScope, @Query(new ZodValidationPipe(listPromotionsSchema)) query: ListPromotionsQuery) {
    return this.promotions.list(scope, query);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body(new ZodValidationPipe(promotionSchema)) body: PromotionDto) {
    return this.promotions.create(user, body, req.ip);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ZodValidationPipe(promotionIdSchema)) id: string,
    @Body(new ZodValidationPipe(promotionSchema)) body: PromotionDto,
  ) {
    return this.promotions.update(user, id, body, req.ip);
  }
}
