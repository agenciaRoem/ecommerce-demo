import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerPricingService } from '../catalog/customer-pricing.service';
import type { PriceView } from '../catalog/promotion-pricing';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import type { StockLine } from '../inventory/stock-reservation.service';
import { ImageUrls, MediaUrlService } from '../media/media-url.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';

export interface CartLineView {
  productId: string;
  name: string;
  image: ImageUrls | null;
  quantity: number;
  price: PriceView;
  /** Total de la línea: precio final por cantidad. */
  lineTotal: string;
}

export interface BranchFulfillment {
  id: string;
  name: string;
  address: string;
  /** Tiene stock disponible para todo el carrito. */
  canFulfill: boolean;
  shortages: { productId: string; name: string; requested: number; available: number }[];
}

export interface CartView {
  lines: CartLineView[];
  count: number;
  subtotal: string;
  branches: BranchFulfillment[];
}

/** Arma el carrito para mostrarlo: precios del cliente, y qué sucursales pueden cumplir el pedido completo. */
@Injectable()
export class CartViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly pricing: CustomerPricingService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  async build(customer: AuthenticatedCustomer, branchId?: string): Promise<CartView> {
    const stored = await this.cart.lines(customer.id);
    if (stored.length === 0) return { lines: [], count: 0, subtotal: '0.00', branches: [] };

    const products = await this.prisma.product.findMany({
      where: { id: { in: stored.map((line) => line.productId) }, isActive: true },
      select: { id: true, name: true, categoryId: true, imageKey: true, retailPrice: true, wholesalePrice: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    // Un producto que dejó de estar a la venta se saca del carrito en vez de trabar la compra.
    const gone = stored.filter((line) => !byId.has(line.productId)).map((line) => line.productId);
    if (gone.length > 0) await this.cart.remove(customer.id, gone);
    const active = stored.filter((line) => byId.has(line.productId));

    const prices = await this.pricing.priceProducts(customer, products, branchId);
    const lines = active.map(({ productId, quantity }): CartLineView => {
      const product = byId.get(productId)!;
      const { view, finalPrice } = prices.get(productId)!;
      return {
        productId,
        name: product.name,
        image: this.mediaUrls.forKey(product.imageKey),
        quantity,
        price: view,
        lineTotal: finalPrice.mul(quantity).toFixed(2),
      };
    });

    const subtotal = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    return {
      lines,
      count: lines.reduce((total, line) => total + line.quantity, 0),
      subtotal: subtotal.toFixed(2),
      branches: await this.fulfillment(active, new Map(products.map((p) => [p.id, p.name]))),
    };
  }

  private async fulfillment(lines: readonly StockLine[], names: ReadonlyMap<string, string>): Promise<BranchFulfillment[]> {
    const [branches, inventories] = await Promise.all([
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, address: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.branchInventory.findMany({
        where: { productId: { in: lines.map((line) => line.productId) }, branch: { isActive: true } },
        select: { branchId: true, productId: true, stock: true, reserved: true },
      }),
    ]);

    const available = new Map(inventories.map((row) => [`${row.branchId}:${row.productId}`, Math.max(0, row.stock - row.reserved)]));
    return branches.map((branch) => {
      const shortages = lines.flatMap(({ productId, quantity }) => {
        const units = available.get(`${branch.id}:${productId}`) ?? 0;
        return units >= quantity ? [] : [{ productId, name: names.get(productId) ?? '', requested: quantity, available: units }];
      });
      return { ...branch, canFulfill: shortages.length === 0, shortages };
    });
  }
}
