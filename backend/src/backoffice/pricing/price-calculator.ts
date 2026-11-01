import { Prisma } from '@prisma/client';

export type Rounding = 'NONE' | 'UNIT' | 'TEN' | 'HUNDRED';

/** Cambio masivo de precios. Cada modo parte de lo que vale hoy el producto, nunca de valores del cliente. */
export type BulkChange =
  /** Recalcula los precios como costo + margen. Lo que no se indica queda como está. */
  | { mode: 'MARGIN'; retailMarginPercent?: number; wholesaleMarginPercent?: number }
  /** Sube o baja los precios de venta un porcentaje. El costo no cambia. */
  | { mode: 'ADJUST_PRICES'; percent: number; applyTo: 'RETAIL' | 'WHOLESALE' | 'BOTH' }
  /** El proveedor aumentó: el costo y los precios suben juntos, así se conservan los márgenes. */
  | { mode: 'ADJUST_COST'; percent: number };

export interface PriceSet {
  cost: Prisma.Decimal;
  retailPrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal;
}

export type PriceProblem = 'BELOW_COST' | 'WHOLESALE_ABOVE_RETAIL' | 'TOO_LARGE';

export const PROBLEM_LABEL: Record<PriceProblem, string> = {
  BELOW_COST: 'Quedaría por debajo del costo',
  WHOLESALE_ABOVE_RETAIL: 'El precio mayorista quedaría por encima del minorista',
  TOO_LARGE: 'El importe es demasiado grande',
};

/** Tope por columna `Decimal(12,2)`, con margen de sobra para que nadie cargue un importe absurdo. */
export const MAX_AMOUNT = new Prisma.Decimal(100_000_000);

const ROUNDING_STEP: Record<Exclude<Rounding, 'NONE'>, number> = { UNIT: 1, TEN: 10, HUNDRED: 100 };

const cents = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const factor = (percent: number) => new Prisma.Decimal(100).add(percent).div(100);

/** Redondea siempre hacia arriba: así un precio nunca baja por debajo de lo que dio el cálculo (ni del costo). */
export function roundPrice(value: Prisma.Decimal, rounding: Rounding): Prisma.Decimal {
  if (rounding === 'NONE') return cents(value);
  const step = ROUNDING_STEP[rounding];
  return value.div(step).ceil().mul(step);
}

export function applyChange(current: PriceSet, change: BulkChange, rounding: Rounding): PriceSet {
  switch (change.mode) {
    case 'MARGIN':
      return {
        cost: current.cost,
        retailPrice:
          change.retailMarginPercent === undefined ? current.retailPrice : roundPrice(current.cost.mul(factor(change.retailMarginPercent)), rounding),
        wholesalePrice:
          change.wholesaleMarginPercent === undefined
            ? current.wholesalePrice
            : roundPrice(current.cost.mul(factor(change.wholesaleMarginPercent)), rounding),
      };
    case 'ADJUST_PRICES': {
      const by = factor(change.percent);
      return {
        cost: current.cost,
        retailPrice: change.applyTo === 'WHOLESALE' ? current.retailPrice : roundPrice(current.retailPrice.mul(by), rounding),
        wholesalePrice: change.applyTo === 'RETAIL' ? current.wholesalePrice : roundPrice(current.wholesalePrice.mul(by), rounding),
      };
    }
    case 'ADJUST_COST': {
      const by = factor(change.percent);
      return {
        cost: cents(current.cost.mul(by)),
        retailPrice: roundPrice(current.retailPrice.mul(by), rounding),
        wholesalePrice: roundPrice(current.wholesalePrice.mul(by), rounding),
      };
    }
  }
}

/** Reglas que deben cumplir los precios de un producto; `null` si están bien. */
export function findProblem({ cost, retailPrice, wholesalePrice }: PriceSet): PriceProblem | null {
  if ([cost, retailPrice, wholesalePrice].some((value) => value.gt(MAX_AMOUNT))) return 'TOO_LARGE';
  if (retailPrice.lt(cost) || wholesalePrice.lt(cost)) return 'BELOW_COST';
  if (wholesalePrice.gt(retailPrice)) return 'WHOLESALE_ABOVE_RETAIL';
  return null;
}

export const samePrices = (a: PriceSet, b: PriceSet): boolean =>
  a.cost.eq(b.cost) && a.retailPrice.eq(b.retailPrice) && a.wholesalePrice.eq(b.wholesalePrice);

/** Margen sobre el costo en porcentaje (`null` si el costo es 0 y no hay base para calcularlo). */
export function marginPercent(price: Prisma.Decimal, cost: Prisma.Decimal): string | null {
  return cost.isZero() ? null : price.sub(cost).div(cost).mul(100).toDecimalPlaces(1).toFixed(1);
}
