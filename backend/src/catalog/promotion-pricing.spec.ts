import { Prisma } from '@prisma/client';
import { ActivePromotion, promotionProductWhere, resolvePrice } from './promotion-pricing';

const D = (value: string | number) => new Prisma.Decimal(value);
const product = { id: 'p1', categoryId: 'c1' };

const promo = (overrides: Partial<ActivePromotion> = {}): ActivePromotion => ({
  id: 'promo1',
  name: 'Vuelta a clases',
  discountType: 'PERCENTAGE',
  value: D(20),
  scope: 'ALL',
  categoryId: null,
  productIds: new Set(),
  ...overrides,
});

describe('resolvePrice', () => {
  it('sin promociones devuelve el precio de lista', () => {
    expect(resolvePrice(D(1000), product, [])).toEqual({
      price: '1000.00',
      listPrice: null,
      discountPercent: null,
      promotion: null,
    });
  });

  it('aplica un porcentaje', () => {
    const view = resolvePrice(D(1000), product, [promo()]);
    expect(view).toMatchObject({ price: '800.00', listPrice: '1000.00', discountPercent: 20 });
    expect(view.promotion).toEqual({ id: 'promo1', name: 'Vuelta a clases' });
  });

  it('aplica un monto fijo y calcula el porcentaje equivalente', () => {
    const view = resolvePrice(D(1000), product, [promo({ discountType: 'FIXED_AMOUNT', value: D(250) })]);
    expect(view).toMatchObject({ price: '750.00', discountPercent: 25 });
  });

  it('un monto fijo mayor al precio no deja el precio negativo', () => {
    const view = resolvePrice(D(100), product, [promo({ discountType: 'FIXED_AMOUNT', value: D(500) })]);
    expect(view.price).toBe('0.00');
  });

  it('elige la promoción más conveniente', () => {
    const view = resolvePrice(D(1000), product, [
      promo({ id: 'a', value: D(10) }),
      promo({ id: 'b', value: D(30) }),
      promo({ id: 'c', value: D(20) }),
    ]);
    expect(view.promotion?.id).toBe('b');
    expect(view.price).toBe('700.00');
  });

  it('respeta el alcance por categoría', () => {
    const forCategory = promo({ scope: 'CATEGORY', categoryId: 'c1' });
    expect(resolvePrice(D(1000), product, [forCategory]).discountPercent).toBe(20);
    expect(resolvePrice(D(1000), { id: 'p2', categoryId: 'otra' }, [forCategory]).discountPercent).toBeNull();
  });

  it('respeta el alcance por productos', () => {
    const forProducts = promo({ scope: 'PRODUCTS', productIds: new Set(['p1']) });
    expect(resolvePrice(D(1000), product, [forProducts]).discountPercent).toBe(20);
    expect(resolvePrice(D(1000), { id: 'p9', categoryId: 'c1' }, [forProducts]).discountPercent).toBeNull();
  });

  it('redondea a 2 decimales', () => {
    expect(resolvePrice(D('33.33'), product, [promo({ value: D(15) })]).price).toBe('28.33');
  });
});

describe('promotionProductWhere', () => {
  it('sin promociones no selecciona ningún producto', () => {
    expect(promotionProductWhere([])).toEqual({ id: { in: [] } });
  });

  it('una promoción global no restringe', () => {
    expect(promotionProductWhere([promo()])).toEqual({});
  });

  it('combina categorías y productos', () => {
    const where = promotionProductWhere([
      promo({ scope: 'CATEGORY', categoryId: 'c1' }),
      promo({ scope: 'PRODUCTS', productIds: new Set(['p5', 'p6']) }),
    ]);
    expect(where).toEqual({ OR: [{ categoryId: { in: ['c1'] } }, { id: { in: ['p5', 'p6'] } }] });
  });
});
