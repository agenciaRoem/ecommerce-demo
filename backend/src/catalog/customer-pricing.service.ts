import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { PriceView, ProductRef, resolvePrice } from './promotion-pricing';
import { PromotionsService } from './promotions.service';

export interface PricedProduct extends ProductRef {
  retailPrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal;
}

export interface CustomerPrice {
  /** Precio de lista que corresponde al cliente (minorista, o mayorista si su CUIT está verificado). */
  listPrice: Prisma.Decimal;
  /** Descuento por unidad de la mejor promoción vigente (0 si no hay). */
  discountAmount: Prisma.Decimal;
  /** Lo que paga por unidad. */
  finalPrice: Prisma.Decimal;
  promotionId: string | null;
  view: PriceView;
}

/**
 * El precio de un producto para un cliente concreto. Lo usan el carrito y el checkout, que recalculan siempre
 * en el servidor: el cliente nunca informa un precio.
 */
@Injectable()
export class CustomerPricingService {
  constructor(private readonly promotions: PromotionsService) {}

  async priceProducts(
    customer: AuthenticatedCustomer,
    products: readonly PricedProduct[],
    branchId?: string,
  ): Promise<Map<string, CustomerPrice>> {
    const promotions = await this.promotions.activeFor(customer.type, branchId);
    const prices = new Map<string, CustomerPrice>();

    for (const product of products) {
      const listPrice = customer.verified ? product.wholesalePrice : product.retailPrice;
      const view = resolvePrice(listPrice, product, promotions);
      const finalPrice = new Prisma.Decimal(view.price);
      prices.set(product.id, {
        listPrice,
        finalPrice,
        discountAmount: listPrice.sub(finalPrice),
        promotionId: view.promotion?.id ?? null,
        view,
      });
    }
    return prices;
  }
}
