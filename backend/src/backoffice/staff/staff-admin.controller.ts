import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateStaffDto,
  ListStaffQuery,
  UpdateStaffDto,
  createStaffSchema,
  listStaffSchema,
  resetPasswordSchema,
  staffIdSchema,
  updateStaffSchema,
} from './staff-admin.schemas';
import { StaffAdminService } from './staff-admin.service';

/** Alta, roles y baja del personal. Solo el SUPERADMIN. */
@Roles('SUPERADMIN')
@Controller('backoffice/staff')
export class StaffAdminController {
  constructor(private readonly staff: StaffAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listStaffSchema)) query: ListStaffQuery) {
    return this.staff.list(query);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Body(new ZodValidationPipe(createStaffSchema)) body: CreateStaffDto) {
    return this.staff.create(user.id, body, req.ip);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ZodValidationPipe(staffIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) body: UpdateStaffDto,
  ) {
    return this.staff.update(user.id, id, body, req.ip);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/password')
  @HttpCode(204)
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ZodValidationPipe(staffIdSchema)) id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: { password: string },
  ) {
    await this.staff.resetPassword(user.id, id, body.password, req.ip);
  }
}
