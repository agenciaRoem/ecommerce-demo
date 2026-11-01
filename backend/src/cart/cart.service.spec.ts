import { BadRequestException } from '@nestjs/common';
import { CART_MAX_LINES, CART_MAX_QUANTITY, CartService } from './cart.service';

/** Redis mínimo en memoria: solo los comandos de hash que usa el carrito. */
function fakeRedis() {
  const hashes = new Map<string, Map<string, string>>();
  const activity = new Map<string, number>();
  const hash = (key: string) => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!;
  return {
    hashes,
    hgetall: async (key: string) => Object.fromEntries(hash(key)),
    hincrby: async (key: string, field: string, by: number) => {
      const next = Number(hash(key).get(field) ?? 0) + by;
      hash(key).set(field, String(next));
      return next;
    },
    hset: async (key: string, field: string, value: number) => void hash(key).set(field, String(value)),
    hdel: async (key: string, ...fields: string[]) => void fields.forEach((f) => hash(key).delete(f)),
    hexists: async (key: string, field: string) => (hash(key).has(field) ? 1 : 0),
    hlen: async (key: string) => hash(key).size,
    expire: jest.fn(async () => 1),
    del: async (key: string) => void hashes.delete(key),
    zadd: async (key: string, score: number, member: string) => void activity.set(member, score),
    zrem: async (key: string, member: string) => void activity.delete(member),
    activity,
  };
}

const setup = () => {
  const redis = fakeRedis();
  return { cart: new CartService(redis as never), redis };
};

describe('CartService', () => {
  it('agrega y suma cantidades del mismo producto', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', 2);
    await cart.add('c1', 'p1', 3);
    await cart.add('c1', 'p2', 1);
    expect(await cart.lines('c1')).toEqual(expect.arrayContaining([{ productId: 'p1', quantity: 5 }, { productId: 'p2', quantity: 1 }]));
    expect(await cart.count('c1')).toBe(6);
  });

  it('cada cliente tiene su propio carrito', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', 1);
    expect(await cart.lines('c2')).toEqual([]);
  });

  it('limita la cantidad por producto', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', CART_MAX_QUANTITY);
    await cart.add('c1', 'p1', 50);
    expect(await cart.lines('c1')).toEqual([{ productId: 'p1', quantity: CART_MAX_QUANTITY }]);

    await cart.set('c1', 'p1', CART_MAX_QUANTITY + 500);
    expect((await cart.lines('c1'))[0].quantity).toBe(CART_MAX_QUANTITY);
  });

  it('limita la cantidad de productos distintos, pero deja modificar los que ya están', async () => {
    const { cart } = setup();
    for (let i = 0; i < CART_MAX_LINES; i++) await cart.add('c1', `p${i}`, 1);

    await expect(cart.add('c1', 'nuevo', 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(cart.set('c1', 'nuevo', 1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(cart.add('c1', 'p0', 1)).resolves.toBeUndefined();
  });

  it('set fija la cantidad y 0 quita el producto', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', 5);
    await cart.set('c1', 'p1', 2);
    expect(await cart.lines('c1')).toEqual([{ productId: 'p1', quantity: 2 }]);
    await cart.set('c1', 'p1', 0);
    expect(await cart.lines('c1')).toEqual([]);
  });

  it('descarta datos corruptos al leer', async () => {
    const { cart, redis } = setup();
    redis.hashes.set('cart:c1', new Map([['p1', 'abc'], ['p2', '-3'], ['p3', '2.5'], ['p4', '4']]));
    expect(await cart.lines('c1')).toEqual([{ productId: 'p4', quantity: 4 }]);
  });

  it('consume lo comprado y conserva lo agregado después', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', 5);
    await cart.add('c1', 'p2', 2);
    await cart.consume('c1', [{ productId: 'p1', quantity: 3 }, { productId: 'p2', quantity: 2 }]);
    expect(await cart.lines('c1')).toEqual([{ productId: 'p1', quantity: 2 }]);
  });

  it('el carrito vence solo (se renueva con cada cambio)', async () => {
    const { cart, redis } = setup();
    await cart.add('c1', 'p1', 1);
    expect(redis.expire).toHaveBeenCalledWith('cart:c1', 30 * 24 * 60 * 60);
  });

  it('clear vacía el carrito', async () => {
    const { cart } = setup();
    await cart.add('c1', 'p1', 1);
    await cart.clear('c1');
    expect(await cart.lines('c1')).toEqual([]);
  });
});
