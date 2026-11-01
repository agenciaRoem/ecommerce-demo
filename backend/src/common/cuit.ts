const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
/** Prefijos asignados: personas humanas (20, 23, 24, 27) y personas jurídicas (30, 33, 34). */
const VALID_PREFIXES = new Set(['20', '23', '24', '27', '30', '33', '34']);

/** Deja solo los dígitos: "30-50001091-2" → "30500010912". */
export const normalizeCuit = (raw: string): string => raw.replace(/\D/g, '');

/**
 * Valida el formato (11 dígitos), el prefijo y el dígito verificador de un CUIT/CUIL.
 * No consulta a ARCA: confirma que el número es *posible*, no que exista ni que esté activo.
 */
export function isValidCuit(raw: string): boolean {
  const cuit = normalizeCuit(raw);
  if (!/^\d{11}$/.test(cuit) || !VALID_PREFIXES.has(cuit.slice(0, 2))) return false;

  const sum = WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(cuit[i]), 0);
  const remainder = sum % 11;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return expected !== 10 && expected === Number(cuit[10]);
}
