import { addDays, eachDay, previousRange, resolveRange, todayIn } from './date-range';

describe('date-range', () => {
  it('por defecto toma los últimos 30 días hasta hoy', () => {
    expect(resolveRange({}, '2026-11-30')).toEqual({ from: '2026-11-01', to: '2026-11-30', days: 30 });
  });

  it('respeta un rango pedido, con los extremos incluidos', () => {
    expect(resolveRange({ from: '2026-11-01', to: '2026-11-07' }, '2026-11-30').days).toBe(7);
    expect(resolveRange({ from: '2026-11-05', to: '2026-11-05' }, '2026-11-30').days).toBe(1);
  });

  it('rechaza rangos invertidos, futuros o demasiado largos', () => {
    expect(() => resolveRange({ from: '2026-11-10', to: '2026-11-01' }, '2026-11-30')).toThrow(RangeError);
    expect(() => resolveRange({ to: '2026-12-01' }, '2026-11-30')).toThrow(RangeError);
    expect(() => resolveRange({ from: '2025-01-01', to: '2026-11-30' }, '2026-11-30')).toThrow(RangeError);
  });

  it('el período anterior es contiguo y de igual duración', () => {
    const range = resolveRange({ from: '2026-11-08', to: '2026-11-14' }, '2026-11-30');
    expect(previousRange(range)).toEqual({ from: '2026-11-01', to: '2026-11-07', days: 7 });
  });

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(eachDay({ from: '2026-12-30', to: '2027-01-02', days: 4 })).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('"hoy" depende de la zona horaria del negocio', () => {
    const instant = new Date('2026-11-10T01:30:00Z'); // en Buenos Aires todavía es el 9
    expect(todayIn('America/Argentina/Buenos_Aires', instant)).toBe('2026-11-09');
    expect(todayIn('UTC', instant)).toBe('2026-11-10');
  });
});
