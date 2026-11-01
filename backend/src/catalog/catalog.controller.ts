import { Controller, Get, Param, Query } from '@nestjs/common';
import { OptionalCustomer } from '../common/decorators/audience.decorator';
import { CurrentCustomer } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import {
  BranchQuery,
  CatalogListQuery,
  branchQuerySchema,
  catalogListSchema,
  productIdSchema,
} from './catalog.schemas';
import { CatalogService } from './catalog.service';

/** API pública de la tienda. Si hay un cliente con sesión, los precios se ajustan a su tipo de cuenta. */
@OptionalCustomer()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('branches')
  branches() {
    return this.catalog.listBranches();
  }

  @Get('products')
  products(
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
    @Query(new ZodValidationPipe(catalogListSchema)) query: CatalogListQuery,
  ) {
    return this.catalog.list(customer, query);
  }

  @Get('products/:id')
  product(
    @CurrentCustomer() customer: AuthenticatedCustomer | undefined,
    @Param('id', new ZodValidationPipe(productIdSchema)) id: string,
    @Query(new ZodValidationPipe(branchQuerySchema)) query: BranchQuery,
  ) {
    return this.catalog.detail(customer, id, query.branchId);
  }

  /** Liviano, pensado para consultarse cada pocos segundos desde la ficha del producto. */
  @Get('products/:id/availability')
  availability(@Param('id', new ZodValidationPipe(productIdSchema)) id: string) {
    return this.catalog.branchAvailability(id);
  }
}
