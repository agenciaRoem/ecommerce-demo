// Misma regla que el backend (`backend/src/common/cuit.ts`): se valida acá solo para avisar al instante;
// la API vuelve a validar siempre.
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const VALID_PREFIXES = new Set(['20', '23', '24', '27', '30', '33', '34']);

export const normalizeCuit = (raw: string) => raw.replace(/\D/g, '');

export function isValidCuit(raw: string): boolean {
  const cuit = normalizeCuit(raw);
  if (!/^\d{11}$/.test(cuit) || !VALID_PREFIXES.has(cuit.slice(0, 2))) return false;
  const sum = WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(cuit[i]), 0);
  const remainder = sum % 11;
  const expected = remainder === 0 ? 0 : 11 - remainder;
  return expected !== 10 && expected === Number(cuit[10]);
}

/** "30500010912" → "30-50001091-2", mientras se escribe. */
export function formatCuit(raw: string): string {
  const d = normalizeCuit(raw).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}
