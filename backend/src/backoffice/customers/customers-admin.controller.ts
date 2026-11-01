import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ListCommerceQuery, VerifyCuitDto, customerIdSchema, listCommerceSchema, verifyCuitSchema } from './customers-admin.schemas';
import { CustomersAdminService } from './customers-admin.service';

/** Aprobación del CUIT de los comercios. Solo el SUPERADMIN. */
@Roles('SUPERADMIN')
@Controller('backoffice/commerce-customers')
export class CustomersAdminController {
  constructor(private readonly customers: CustomersAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listCommerceSchema)) query: ListCommerceQuery) {
    return this.customers.listCommerce(query);
  }

  @Post(':id/cuit-verification')
  @HttpCode(200)
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('id', new ZodValidationPipe(customerIdSchema)) id: string,
    @Body(new ZodValidationPipe(verifyCuitSchema)) body: VerifyCuitDto,
  ) {
    return this.customers.setCuitVerification(user.id, id, body, req.ip);
  }
}
