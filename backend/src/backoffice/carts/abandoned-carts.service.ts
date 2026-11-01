import { Injectable } from '@nestjs/common';
import { CART_ACTIVITY_KEY, CartService } from '../../cart/cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { AbandonedCartsQuery } from './abandoned-carts.schemas';

/** Los carritos de Redis expiran a los 30 días; el índice de actividad se limpia con el mismo criterio. */
const CART_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Cuántas entradas del índice se revisan por consulta para descartar carritos que ya se vaciaron. */
const SCAN_WINDOW = 200;

export interface AbandonedCart {
  customer: { id: string; name: string; businessName: string | null; email: string; phone: string | null; type: 'RETAIL' | 'COMMERCE' };
  lastActivityAt: string;
  units: number;
  /** A precio de lista (sin promociones): sirve para dimensionar la oportunidad, no como importe a cobrar. */
  estimatedValue: string;
  lines: { productId: string; name: string; sku: string; quantity: number; unitPrice: string }[];
}

/**
 * Carritos con productos que el cliente dejó sin comprar. Los carritos no pertenecen a una sucursal (la sucursal
 * se elige recién al pagar), por eso esta vista es de toda la empresa.
 */
@Injectable()
export class AbandonedCartsService {
  constructor(
    private readonly redis: RedisService,
    private readonly carts: CartService,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: AbandonedCartsQuery): Promise<{ items: AbandonedCart[]; total: number; page: number; limit: number }> {
    const now = Date.now();
    const cutoff = now - query.idleMinutes * 60_000;
    await this.redis.zremrangebyscore(CART_ACTIVITY_KEY, '-inf', now - CART_RETENTION_MS);

    // Del más reciente al más viejo: lo más probable de recuperar va primero. Se revisa una ventana y se descartan
    // los carritos vacíos (el cliente compró o los vació) para que la página no salga con huecos.
    const candidates = await this.redis.zrevrangebyscore(CART_ACTIVITY_KEY, cutoff, '-inf', 'WITHSCORES', 'LIMIT', (query.page - 1) * query.limit, SCAN_WINDOW);
    const entries: { customerId: string; at: number }[] = [];
    for (let i = 0; i < candidates.length; i += 2) entries.push({ customerId: candidates[i], at: Number(candidates[i + 1]) });

    const filled = await Promise.all(
      entries.map(async (entry) => ({ ...entry, lines: await this.carts.lines(entry.customerId) })),
    );
    const empty = filled.filter((entry) => entry.lines.length === 0);
    if (empty.length > 0) await this.redis.zrem(CART_ACTIVITY_KEY, ...empty.map((entry) => entry.customerId));
    const page = filled.filter((entry) => entry.lines.length > 0).slice(0, query.limit);

    const [customers, products, total] = await Promise.all([
      this.prisma.customer.findMany({ where: { id: { in: page.map((entry) => entry.customerId) } } }),
      this.prisma.product.findMany({
        where: { id: { in: [...new Set(page.flatMap((entry) => entry.lines.map((line) => line.productId)))] } },
        select: { id: true, sku: true, name: true, isActive: true, retailPrice: true, wholesalePrice: true },
      }),
      this.redis.zcount(CART_ACTIVITY_KEY, '-inf', cutoff),
    ]);
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const productById = new Map(products.map((product) => [product.id, product]));

    const items = page.flatMap((entry): AbandonedCart[] => {
      const customer = customerById.get(entry.customerId);
      if (!customer?.isActive) return [];
      const wholesale = customer.type === 'COMMERCE' && customer.cuitVerified;

      const lines = entry.lines.flatMap((line) => {
        const product = productById.get(line.productId);
        if (!product?.isActive) return []; // un producto dado de baja ya no se puede recuperar
        const unitPrice = wholesale ? product.wholesalePrice : product.retailPrice;
        return [{ productId: product.id, name: product.name, sku: product.sku, quantity: line.quantity, unitPrice: unitPrice.toFixed(2) }];
      });
      if (lines.length === 0) return [];

      const value = lines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0);
      return [
        {
          customer: {
            id: customer.id,
            name: customer.fullName,
            businessName: customer.businessName,
            email: customer.email,
            phone: customer.phone,
            type: customer.type,
          },
          lastActivityAt: new Date(entry.at).toISOString(),
          units: lines.reduce((sum, line) => sum + line.quantity, 0),
          estimatedValue: value.toFixed(2),
          lines,
        },
      ];
    });

    return { items, total, page: query.page, limit: query.limit };
  }
}
