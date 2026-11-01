import { availabilityLevel, availableUnits, sumAvailable } from './availability';

describe('availability', () => {
  it('descuenta lo reservado y nunca baja de cero', () => {
    expect(availableUnits({ stock: 10, reserved: 3 })).toBe(7);
    expect(availableUnits({ stock: 2, reserved: 5 })).toBe(0);
  });

  it('suma las sucursales', () => {
    expect(sumAvailable([{ stock: 10, reserved: 3 }, { stock: 4, reserved: 4 }, { stock: 1, reserved: 0 }])).toBe(8);
    expect(sumAvailable([])).toBe(0);
  });

  it.each([
    [0, 'out'],
    [1, 'low'],
    [5, 'low'],
    [6, 'in_stock'],
    [200, 'in_stock'],
  ] as const)('%i unidades → %s', (units, level) => {
    expect(availabilityLevel(units)).toBe(level);
  });
});
