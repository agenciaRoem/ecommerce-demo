import { ConflictException, NotFoundException } from '@nestjs/common';
import { adjustStockSchema } from './inventory.schemas';
import { InventoryService } from './inventory.service';

const PRODUCT = '7c76461f-4bf7-4cdb-9623-1bb58b22c87a';
const parse = (value: unknown) => adjustStockSchema.safeParse(value);

describe('adjustStockSchema', () => {
  it('acepta una rotura que resta unidades', () => {
    expect(parse({ productId: PRODUCT, delta: -2, reason: 'DAMAGED' }).success).toBe(true);
  });

  it('acepta un sobrante que suma unidades', () => {
    expect(parse({ productId: PRODUCT, delta: 3, reason: 'FOUND' }).success).toBe(true);
  });

  it.each([0, 1.5, 10_001, -10_001])('rechaza la diferencia %s', (delta) => {
    expect(parse({ productId: PRODUCT, delta, reason: 'OTHER', note: 'x' }).success).toBe(false);
  });

  it('el motivo debe coincidir con el sentido del ajuste', () => {
    expect(parse({ productId: PRODUCT, delta: 2, reason: 'DAMAGED' }).success).toBe(false);
    expect(parse({ productId: PRODUCT, delta: 2, reason: 'LOST' }).success).toBe(false);
    expect(parse({ productId: PRODUCT, delta: -2, reason: 'FOUND' }).success).toBe(false);
    expect(parse({ productId: PRODUCT, delta: -2, reason: 'RETURN' }).success).toBe(false);
  });

  it('"Otro motivo" exige explicarlo', () => {
    expect(parse({ productId: PRODUCT, delta: -1, reason: 'OTHER' }).success).toBe(false);
    expect(parse({ productId: PRODUCT, delta: -1, reason: 'OTHER', note: 'se cayó la góndola' }).success).toBe(true);
  });

  it('rechaza motivos inventados y caracteres de control', () => {
    expect(parse({ productId: PRODUCT, delta: -1, reason: 'ROBO' }).success).toBe(false);
    expect(parse({ productId: PRODUCT, delta: -1, reason: 'DAMAGED', note: 'a\u0000b' }).success).toBe(false);
  });
});

function setup(options: { productExists?: boolean; changed?: number; row?: { stock: number; reserved: number } | null } = {}) {
  const row = options.row === undefined ? { stock: 10, reserved: 4 } : options.row;
  const tx = {
    $executeRaw: jest.fn(async () => options.changed ?? 1),
    stockMovement: { create: jest.fn(async () => undefined) },
    branchInventory: {
      findUniqueOrThrow: jest.fn(async () => row),
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async () => undefined),
    },
  };
  const prisma = {
    product: { findFirst: jest.fn(async () => (options.productExists === false ? null : { id: PRODUCT })) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new InventoryService(prisma as never, {} as never), tx };
}

describe('InventoryService.adjust', () => {
  it('resta unidades y deja el movimiento con el motivo, la nota y quién lo hizo', async () => {
    const { service, tx } = setup();
    const result = await service.adjust('user-1', 'branch-1', { productId: PRODUCT, delta: -2, reason: 'DAMAGED', note: 'cayó del estante' });

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: { branchId: 'branch-1', productId: PRODUCT, userId: 'user-1', delta: -2, reason: 'ADJUSTMENT', note: 'Rotura o merma: cayó del estante' },
    });
    expect(result).toMatchObject({ stock: 10, reserved: 4, available: 6 });
  });

  it('suma unidades con el mismo registro (y crea la fila si el producto no estaba en la sucursal)', async () => {
    const { service, tx } = setup();
    await service.adjust('user-1', 'branch-1', { productId: PRODUCT, delta: 5, reason: 'FOUND' });
    expect(tx.branchInventory.upsert).toHaveBeenCalled();
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ delta: 5, reason: 'ADJUSTMENT', note: 'Sobrante encontrado', userId: 'user-1' }),
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('no deja descontar lo que está reservado por pedidos en curso y explica cuánto sí se puede', async () => {
    const { service, tx } = setup({ changed: 0, row: { stock: 10, reserved: 8 } });
    await expect(service.adjust('user-1', 'branch-1', { productId: PRODUCT, delta: -5, reason: 'LOST' })).rejects.toThrow(
      /Solo se pueden descontar 2 unidad\(es\).*8 están reservadas/,
    );
    expect(tx.stockMovement.create).not.toHaveBeenCalled(); // sin ajuste no hay movimiento
  });

  it('un producto sin stock en la sucursal informa el problema', async () => {
    const { service } = setup({ changed: 0, row: null });
    await expect(service.adjust('user-1', 'branch-1', { productId: PRODUCT, delta: -1, reason: 'LOST' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('un producto inexistente es 404', async () => {
    const { service } = setup({ productExists: false });
    await expect(service.adjust('user-1', 'branch-1', { productId: PRODUCT, delta: -1, reason: 'LOST' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
