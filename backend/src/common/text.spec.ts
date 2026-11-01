import { hasNoControlChars, plainText, searchText } from './text';

describe('texto sin caracteres de control', () => {
  it('acepta texto normal, acentos, saltos de línea y tabulaciones', () => {
    expect(hasNoControlChars('Cuaderno Ñandú A4')).toBe(true);
    expect(hasNoControlChars('línea 1\nlínea 2\tfin')).toBe(true);
  });

  it.each(['\u0000', 'abc\u0000def', '\u0007', '\u001b[31m', '\u007f'])('rechaza %j', (value) => {
    expect(hasNoControlChars(value)).toBe(false);
  });

  it('plainText recorta, valida largo y rechaza control', () => {
    const schema = plainText(2, 5);
    expect(schema.parse('  hola ')).toBe('hola');
    expect(schema.safeParse('a').success).toBe(false);
    expect(schema.safeParse('demasiado').success).toBe(false);
    expect(schema.safeParse('ho\u0000la').success).toBe(false);
  });

  it('searchText rechaza el NUL que rompería la consulta a PostgreSQL', () => {
    expect(searchText().safeParse('%00').success).toBe(true);
    expect(searchText().safeParse('\u0000').success).toBe(false);
  });
});
