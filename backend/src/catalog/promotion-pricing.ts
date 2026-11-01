import { DiscountType, Prisma, PromotionScope } from '@prisma/client';

/** Promoción vigente, ya cargada junto con los productos a los que apunta. */
export interface ActivePromotion {
  id: string;
  name: string;
  discountType: DiscountType;
  value: Prisma.Decimal;
  scope: PromotionScope;
  categoryId: string | null;
  productIds: ReadonlySet<string>;
}

export interface ProductRef {
  id: string;
  categoryId: string;
}

export interface PriceView {
  /** Precio final a pagar por unidad. */
  price: string;
  /** Precio de lista tachado; `null` si no hay descuento. */
  listPrice: string | null;
  discountPercent: number | null;
  promotion: { id: string; name: string } | null;
}

const ZERO = new Prisma.Decimal(0);

export function promotionApplies(promotion: ActivePromotion, product: ProductRef): boolean {
  switch (promotion.scope) {
    case 'ALL':
      return true;
    case 'CATEGORY':
      return promotion.categoryId === product.categoryId;
    case 'PRODUCTS':
      return promotion.productIds.has(product.id);
  }
}

function applyDiscount(listPrice: Prisma.Decimal, promotion: ActivePromotion): Prisma.Decimal {
  const discounted =
    promotion.discountType === 'PERCENTAGE'
      ? listPrice.mul(new Prisma.Decimal(100).sub(promotion.value)).div(100)
      : listPrice.sub(promotion.value);
  return Prisma.Decimal.max(discounted, ZERO).toDecimalPlaces(2);
}

/** Precio final de un producto: aplica, de las promociones vigentes que le corresponden, la más conveniente. */
export function resolvePrice(
  listPrice: Prisma.Decimal,
  product: ProductRef,
  promotions: readonly ActivePromotion[],
): PriceView {
  let best: { promotion: ActivePromotion; price: Prisma.Decimal } | null = null;
  for (const promotion of promotions) {
    if (!promotionApplies(promotion, product)) continue;
    const price = applyDiscount(listPrice, promotion);
    if (price.lt(listPrice) && (!best || price.lt(best.price))) best = { promotion, price };
  }

  if (!best) return { price: listPrice.toFixed(2), listPrice: null, discountPercent: null, promotion: null };

  const discountPercent = listPrice.sub(best.price).div(listPrice).mul(100).toDecimalPlaces(0).toNumber();
  return {
    price: best.price.toFixed(2),
    listPrice: listPrice.toFixed(2),
    discountPercent,
    promotion: { id: best.promotion.id, name: best.promotion.name },
  };
}

/** Condición de Prisma que deja solo los productos alcanzados por alguna de las promociones. */
export function promotionProductWhere(promotions: readonly ActivePromotion[]): Prisma.ProductWhereInput {
  if (promotions.some((p) => p.scope === 'ALL')) return {};

  const categoryIds = promotions.filter((p) => p.scope === 'CATEGORY' && p.categoryId).map((p) => p.categoryId!);
  const productIds = promotions.flatMap((p) => (p.scope === 'PRODUCTS' ? [...p.productIds] : []));
  const conditions: Prisma.ProductWhereInput[] = [];
  if (categoryIds.length) conditions.push({ categoryId: { in: categoryIds } });
  if (productIds.length) conditions.push({ id: { in: productIds } });

  // Sin promociones vigentes no hay nada en oferta.
  return conditions.length ? { OR: conditions } : { id: { in: [] } };
}
