import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { BranchScope } from '../common/branch-scope';
import { CurrentBranchScope, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import {
  CreateProductDto,
  ListProductsQuery,
  LookupProductQuery,
  UpdateProductDto,
  createProductSchema,
  listProductsSchema,
  lookupProductSchema,
  productIdSchema,
  updateProductSchema,
} from './products.schemas';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Query(new ZodValidationPipe(listProductsSchema)) query: ListProductsQuery,
  ) {
    return this.products.list(user, scope, query);
  }

  @Get('lookup')
  lookup(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Query(new ZodValidationPipe(lookupProductSchema)) query: LookupProductQuery,
  ) {
    return this.products.lookup(user, scope, query.code);
  }

  @Roles('STOCKEO', 'ENCARGADO_STOCK', 'GERENTE')
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductDto,
  ) {
    return this.products.create(user, scope, body);
  }

  @Roles('ENCARGADO_STOCK', 'GERENTE')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBranchScope() scope: BranchScope,
    @Param('id', new ZodValidationPipe(productIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductDto,
  ) {
    return this.products.update(user, scope, id, body);
  }
}
