export type AvailabilityLevel = 'in_stock' | 'low' | 'out';

/** Hasta esta cantidad se muestra "últimas unidades". */
export const LOW_STOCK_UNITS = 5;

export const availableUnits = ({ stock, reserved }: { stock: number; reserved: number }): number =>
  Math.max(0, stock - reserved);

export function availabilityLevel(units: number): AvailabilityLevel {
  if (units <= 0) return 'out';
  return units <= LOW_STOCK_UNITS ? 'low' : 'in_stock';
}

export const sumAvailable = (rows: { stock: number; reserved: number }[]): number =>
  rows.reduce((total, row) => total + availableUnits(row), 0);
