import { Prisma } from '@prisma/client';
import { PriceSet, applyChange, findProblem, marginPercent, roundPrice, samePrices } from './price-calculator';

const D = (value: string | number) => new Prisma.Decimal(value);
const prices = (cost: string, retail: string, wholesale: string): PriceSet => ({ cost: D(cost), retailPrice: D(retail), wholesalePrice: D(wholesale) });
const asStrings = (set: PriceSet) => [set.cost.toFixed(2), set.retailPrice.toFixed(2), set.wholesalePrice.toFixed(2)];

describe('price-calculator', () => {
  describe('roundPrice', () => {
    it('sin redondeo deja centavos', () => {
      expect(roundPrice(D('10.005'), 'NONE').toFixed(2)).toBe('10.01');
    });

    it('redondea siempre hacia arriba al paso elegido', () => {
      expect(roundPrice(D('1234.01'), 'UNIT').toFixed(2)).toBe('1235.00');
      expect(roundPrice(D('1231'), 'TEN').toFixed(2)).toBe('1240.00');
      expect(roundPrice(D('1200'), 'HUNDRED').toFixed(2)).toBe('1200.00');
      expect(roundPrice(D('1201'), 'HUNDRED').toFixed(2)).toBe('1300.00');
    });
  });

  describe('applyChange', () => {
    const base = prices('100', '150', '120');

    it('MARGIN recalcula desde el costo y respeta lo que no se indica', () => {
      expect(asStrings(applyChange(base, { mode: 'MARGIN', retailMarginPercent: 80 }, 'NONE'))).toEqual(['100.00', '180.00', '120.00']);
      expect(asStrings(applyChange(base, { mode: 'MARGIN', retailMarginPercent: 80, wholesaleMarginPercent: 30 }, 'NONE'))).toEqual(['100.00', '180.00', '130.00']);
    });

    it('ADJUST_PRICES afecta solo la lista elegida y no toca el costo', () => {
      expect(asStrings(applyChange(base, { mode: 'ADJUST_PRICES', percent: 10, applyTo: 'RETAIL' }, 'NONE'))).toEqual(['100.00', '165.00', '120.00']);
      expect(asStrings(applyChange(base, { mode: 'ADJUST_PRICES', percent: 10, applyTo: 'WHOLESALE' }, 'NONE'))).toEqual(['100.00', '150.00', '132.00']);
      expect(asStrings(applyChange(base, { mode: 'ADJUST_PRICES', percent: -10, applyTo: 'BOTH' }, 'NONE'))).toEqual(['100.00', '135.00', '108.00']);
    });

    it('ADJUST_COST traslada el aumento al costo y a ambos precios', () => {
      expect(asStrings(applyChange(base, { mode: 'ADJUST_COST', percent: 20 }, 'NONE'))).toEqual(['120.00', '180.00', '144.00']);
    });

    it('aplica el redondeo solo a los precios, no al costo', () => {
      const result = applyChange(prices('101', '150', '120'), { mode: 'ADJUST_COST', percent: 3 }, 'TEN');
      expect(asStrings(result)).toEqual(['104.03', '160.00', '130.00']);
    });
  });

  describe('findProblem', () => {
    it('acepta precios coherentes', () => {
      expect(findProblem(prices('100', '150', '120'))).toBeNull();
      expect(findProblem(prices('100', '100', '100'))).toBeNull();
    });

    it('detecta venta por debajo del costo, mayorista por encima del minorista e importes enormes', () => {
      expect(findProblem(prices('100', '90', '80'))).toBe('BELOW_COST');
      expect(findProblem(prices('100', '150', '160'))).toBe('WHOLESALE_ABOVE_RETAIL');
      expect(findProblem(prices('100', '999999999', '120'))).toBe('TOO_LARGE');
    });
  });

  it('samePrices distingue cualquier cambio', () => {
    expect(samePrices(prices('1', '2', '3'), prices('1', '2', '3'))).toBe(true);
    expect(samePrices(prices('1', '2', '3'), prices('1', '2', '3.01'))).toBe(false);
  });

  it('marginPercent calcula sobre el costo y tolera costo cero', () => {
    expect(marginPercent(D('150'), D('100'))).toBe('50.0');
    expect(marginPercent(D('10'), D('0'))).toBeNull();
  });
});
