import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import type { BranchScope } from '../../common/branch-scope';
import { InjectConfig } from '../../config/config.module';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import type { LowStockQuery, OverviewQuery } from './analytics.schemas';
import { DateRange, eachDay, previousRange, resolveRange, todayIn } from './date-range';

const ZERO = new Prisma.Decimal(0);
const money = (value: Prisma.Decimal | null | undefined): string => (value ?? ZERO).toFixed(2);

export interface PeriodTotals {
  orders: number;
  units: number;
  revenue: string;
  averageTicket: string;
  discounts: string;
  /** Ventas de mercadería menos su costo *actual*: una estimación, porque el costo puede haber cambiado. */
  estimatedMargin: string;
}

interface Slice {
  key: string;
  label: string;
  orders: number;
  revenue: string;
}

export interface Overview {
  range: DateRange;
  timezone: string;
  totals: PeriodTotals;
  previous: PeriodTotals;
  series: { day: string; orders: number; revenue: string }[];
  topProducts: { productId: string; sku: string; name: string; units: number; revenue: string }[];
  byDelivery: Slice[];
  byCustomerType: Slice[];
  /** Solo cuando se mira el total de la empresa (sin filtrar por sucursal). */
  byBranch: Slice[] | null;
  /** Pedidos pagados que hoy están en cada etapa, sin importar la fecha. */
  pipeline: Partial<Record<OrderStatus, number>>;
}

const DELIVERY_LABEL: Record<string, string> = { PICKUP: 'Retiro en sucursal', SHIPPING: 'Envío' };
const CUSTOMER_LABEL: Record<string, string> = { RETAIL: 'Consumidor final', COMMERCE: 'Comercios (B2B)' };

interface OrderTotalsRow {
  orders: number;
  revenue: Prisma.Decimal;
}
interface ItemTotalsRow {
  units: number;
  discounts: Prisma.Decimal;
  cost: Prisma.Decimal;
  items_revenue: Prisma.Decimal;
}
interface SliceRow {
  key: string;
  label: string | null;
  orders: number;
  revenue: Prisma.Decimal;
}

/**
 * Métricas de venta. Cuenta como venta todo pedido ya pagado (el pago es lo que fija la fecha), sin importar
 * en qué etapa de preparación esté. Todo se calcula en la base con agregaciones: no se cargan pedidos a memoria.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConfig() private readonly config: Env,
  ) {}

  async overview(scope: BranchScope, query: OverviewQuery): Promise<Overview> {
    const range = this.rangeFrom(query);
    const previous = previousRange(range);
    const current = this.paidIn(scope, range);

    const [totals, previousTotals, series, topProducts, byDelivery, byCustomerType, byBranch, pipeline] = await Promise.all([
      this.totals(current),
      this.totals(this.paidIn(scope, previous)),
      this.series(current),
      this.topProducts(current, query.rank),
      this.slices(current, Prisma.sql`o.delivery_method::text`, Prisma.empty, DELIVERY_LABEL),
      this.slices(current, Prisma.sql`c.type::text`, Prisma.sql`JOIN customers c ON c.id = o.customer_id`, CUSTOMER_LABEL),
      scope.branchId
        ? Promise.resolve(null)
        : this.slices(current, Prisma.sql`o.branch_id::text`, Prisma.sql`JOIN branches b ON b.id = o.branch_id`, {}, Prisma.sql`b.name`),
      this.pipeline(scope),
    ]);

    const days = new Map(series.map((row) => [row.day, row]));
    return {
      range,
      timezone: this.config.BUSINESS_TIMEZONE,
      totals,
      previous: previousTotals,
      series: eachDay(range).map((day) => days.get(day) ?? { day, orders: 0, revenue: '0.00' }),
      topProducts,
      byDelivery,
      byCustomerType,
      byBranch,
      pipeline,
    };
  }

  /** Productos con poco stock disponible (físico menos lo reservado), de los más urgentes a los menos. */
  async lowStock(scope: BranchScope, query: LowStockQuery) {
    const rows = await this.prisma.branchInventory.findMany({
      where: { ...scope, product: { isActive: true } },
      select: {
        stock: true,
        reserved: true,
        branch: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    });
    // `stock - reserved` no se puede expresar en el `where` de Prisma; el filtro es barato porque corre sobre
    // las filas de inventario (un producto por sucursal), no sobre pedidos.
    return rows
      .map((row) => ({ ...row, available: row.stock - row.reserved }))
      .filter((row) => row.available <= query.threshold)
      .sort((a, b) => a.available - b.available || a.product.name.localeCompare(b.product.name))
      .slice(0, query.limit);
  }

  private rangeFrom(query: OverviewQuery): DateRange {
    try {
      return resolveRange(query, todayIn(this.config.BUSINESS_TIMEZONE));
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Condición común: pedidos ya pagados cuya fecha de pago cae en el rango (día local del negocio). */
  private paidIn(scope: BranchScope, range: DateRange): Prisma.Sql {
    const tz = this.config.BUSINESS_TIMEZONE;
    const lower = Prisma.sql`(${range.from}::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
    const upper = Prisma.sql`((${range.to}::date + 1)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC'`;
    const branch = scope.branchId ? Prisma.sql`AND o.branch_id = ${scope.branchId}::uuid` : Prisma.empty;
    return Prisma.sql`o.paid_at IS NOT NULL AND o.paid_at >= ${lower} AND o.paid_at < ${upper}
      AND o.status NOT IN ('PENDING_PAYMENT', 'CANCELLED') ${branch}`;
  }

  private async totals(where: Prisma.Sql): Promise<PeriodTotals> {
    const [[order], [items]] = await Promise.all([
      this.prisma.$queryRaw<OrderTotalsRow[]>`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(o.total), 0) AS revenue FROM orders o WHERE ${where}`,
      this.prisma.$queryRaw<ItemTotalsRow[]>`
        SELECT COALESCE(SUM(i.quantity), 0)::int AS units,
               COALESCE(SUM(i.quantity * i.discount_amount), 0) AS discounts,
               COALESCE(SUM(i.quantity * p.cost), 0) AS cost,
               COALESCE(SUM(i.quantity * (i.unit_price - i.discount_amount)), 0) AS items_revenue
        FROM order_items i
        JOIN orders o ON o.id = i.order_id
        JOIN products p ON p.id = i.product_id
        WHERE ${where}`,
    ]);
    return {
      orders: order.orders,
      units: items.units,
      revenue: money(order.revenue),
      averageTicket: money(order.orders > 0 ? order.revenue.div(order.orders) : null),
      discounts: money(items.discounts),
      estimatedMargin: money(items.items_revenue.sub(items.cost)),
    };
  }

  private async series(where: Prisma.Sql) {
    const tz = this.config.BUSINESS_TIMEZONE;
    const rows = await this.prisma.$queryRaw<{ day: string; orders: number; revenue: Prisma.Decimal }[]>`
      SELECT (((o.paid_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date)::text AS day,
             COUNT(*)::int AS orders, SUM(o.total) AS revenue
      FROM orders o WHERE ${where} GROUP BY 1 ORDER BY 1`;
    return rows.map((row) => ({ day: row.day, orders: row.orders, revenue: money(row.revenue) }));
  }

  private async topProducts(where: Prisma.Sql, rank: OverviewQuery['rank']) {
    const order = rank === 'units' ? Prisma.sql`units DESC, revenue DESC` : Prisma.sql`revenue DESC, units DESC`;
    const rows = await this.prisma.$queryRaw<{ product_id: string; sku: string; name: string; units: number; revenue: Prisma.Decimal }[]>`
      SELECT i.product_id::text AS product_id, MAX(i.sku) AS sku, MAX(i.name) AS name,
             SUM(i.quantity)::int AS units, SUM(i.quantity * (i.unit_price - i.discount_amount)) AS revenue
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE ${where} GROUP BY i.product_id ORDER BY ${order} LIMIT 10`;
    return rows.map((row) => ({ productId: row.product_id, sku: row.sku, name: row.name, units: row.units, revenue: money(row.revenue) }));
  }

  private async slices(
    where: Prisma.Sql,
    key: Prisma.Sql,
    join: Prisma.Sql,
    labels: Record<string, string>,
    labelColumn: Prisma.Sql = Prisma.sql`NULL`,
  ): Promise<Slice[]> {
    const rows = await this.prisma.$queryRaw<SliceRow[]>`
      SELECT ${key} AS key, ${labelColumn} AS label, COUNT(*)::int AS orders, SUM(o.total) AS revenue
      FROM orders o ${join} WHERE ${where} GROUP BY 1, 2 ORDER BY revenue DESC`;
    return rows.map((row) => ({ key: row.key, label: row.label ?? labels[row.key] ?? row.key, orders: row.orders, revenue: money(row.revenue) }));
  }

  private async pipeline(scope: BranchScope): Promise<Overview['pipeline']> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { ...scope, status: { in: ['PENDING', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'READY_FOR_FREIGHT'] } },
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }
}
