import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AbandonedCartsQuery, abandonedCartsSchema } from './abandoned-carts.schemas';
import { AbandonedCartsService } from './abandoned-carts.service';

@Roles('GERENTE')
@Controller('backoffice/abandoned-carts')
export class AbandonedCartsController {
  constructor(private readonly carts: AbandonedCartsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(abandonedCartsSchema)) query: AbandonedCartsQuery) {
    return this.carts.list(query);
  }
}
