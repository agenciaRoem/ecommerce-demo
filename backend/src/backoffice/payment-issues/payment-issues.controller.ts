import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ResolveIssueDto, orderIdSchema, resolveIssueSchema } from './payment-issues.schemas';
import { PaymentIssuesService } from './payment-issues.service';

/** Pagos a revisar o reembolsar. Solo el SUPERADMIN (es quien tiene la cuenta de Mercado Pago). */
@Roles('SUPERADMIN')
@Controller('backoffice/payment-issues')
export class PaymentIssuesController {
  constructor(private readonly issues: PaymentIssuesService) {}

  @Get()
  list() {
    return this.issues.list();
  }

  @Post(':orderId/resolve')
  @HttpCode(204)
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Param('orderId', new ZodValidationPipe(orderIdSchema)) orderId: string,
    @Body(new ZodValidationPipe(resolveIssueSchema)) body: ResolveIssueDto,
  ) {
    await this.issues.resolve(user.id, orderId, body, req.ip);
  }
}
