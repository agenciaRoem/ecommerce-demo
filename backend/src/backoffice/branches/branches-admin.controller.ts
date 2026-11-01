import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateBranchDto, UpdateBranchDto, branchIdSchema, createBranchSchema, updateBranchSchema } from './branches-admin.schemas';
import { BranchesAdminService } from './branches-admin.service';

/** Alta y edición de sucursales. Solo el SUPERADMIN. */
@Roles('SUPERADMIN')
@Controller('backoffice/branches')
export class BranchesAdminController {
  constructor(private readonly branches: BranchesAdminService) {}

  @Get()
  list() {
    return this.branches.list();
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchDto) {
    return this.branches.create(user.id, body, req.ip);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ZodValidationPipe(branchIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchDto,
  ) {
    return this.branches.update(user.id, id, body, req.ip);
  }
}
