import { Prisma } from '@prisma/client';
import type { Env } from '../config/env.validation';
import { PricingService } from './pricing.service';

const service = new PricingService({
  DEFAULT_RETAIL_MARGIN_PERCENT: 50,
  DEFAULT_WHOLESALE_MARGIN_PERCENT: 25,
} as Env);

describe('PricingService', () => {
  it('aplica los márgenes sobre el costo', () => {
    const { retailPrice, wholesalePrice } = service.initialPrices(new Prisma.Decimal('100'));
    expect(retailPrice.toFixed(2)).toBe('150.00');
    expect(wholesalePrice.toFixed(2)).toBe('125.00');
  });

  it('redondea a 2 decimales sin errores de punto flotante', () => {
    const { retailPrice } = service.initialPrices(new Prisma.Decimal('0.10'));
    expect(retailPrice.toFixed(2)).toBe('0.15');
    expect(service.initialPrices(new Prisma.Decimal('33.33')).retailPrice.toFixed(2)).toBe('50.00');
  });
});
