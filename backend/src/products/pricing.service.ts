import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';

export interface InitialPrices {
  retailPrice: Prisma.Decimal;
  wholesalePrice: Prisma.Decimal;
}

/** Precios de partida a partir del costo. Un gerente los ajusta después (Fase 7). */
@Injectable()
export class PricingService {
  constructor(@InjectConfig() private readonly config: Env) {}

  initialPrices(cost: Prisma.Decimal): InitialPrices {
    return {
      retailPrice: this.withMargin(cost, this.config.DEFAULT_RETAIL_MARGIN_PERCENT),
      wholesalePrice: this.withMargin(cost, this.config.DEFAULT_WHOLESALE_MARGIN_PERCENT),
    };
  }

  private withMargin(cost: Prisma.Decimal, marginPercent: number): Prisma.Decimal {
    return cost.mul(new Prisma.Decimal(100).add(marginPercent)).div(100).toDecimalPlaces(2);
  }
}
