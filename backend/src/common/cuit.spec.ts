import { isValidCuit, normalizeCuit } from './cuit';

describe('CUIT', () => {
  it('normaliza guiones y espacios', () => {
    expect(normalizeCuit('30-50001091-2')).toBe('30500010912');
    expect(normalizeCuit(' 20 12345678 6 ')).toBe('20123456786');
  });

  it.each(['20-12345678-6', '30500010912', '30-50001091-2'])('acepta %s', (cuit) => {
    expect(isValidCuit(cuit)).toBe(true);
  });

  it('rechaza un dígito verificador incorrecto', () => {
    expect(isValidCuit('20-12345678-5')).toBe(false);
    expect(isValidCuit('30-50001091-3')).toBe(false);
  });

  it('rechaza largo incorrecto y caracteres no numéricos', () => {
    expect(isValidCuit('2012345678')).toBe(false);
    expect(isValidCuit('201234567861')).toBe(false);
    expect(isValidCuit('abc')).toBe(false);
    expect(isValidCuit('')).toBe(false);
  });

  it('rechaza prefijos no asignados', () => {
    expect(isValidCuit('10-12345678-0')).toBe(false);
    expect(isValidCuit('99-99999999-9')).toBe(false);
  });
});
