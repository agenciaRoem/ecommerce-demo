/** Interpretación de números escritos a mano en los formularios del backoffice ("1.500,50", "12,5"). */

function normalize(input: string): string {
  const text = input.trim();
  return text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
}

/** Importe con hasta 2 decimales, cero o más. `null` si no es válido. */
export function parseAmount(input: string): number | null {
  const normalized = normalize(input);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Porcentaje con hasta 2 decimales; admite signo. `null` si no es válido. */
export function parsePercent(input: string): number | null {
  const normalized = normalize(input);
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Margen sobre el costo, en porcentaje con un decimal. */
export function marginOf(price: number, cost: number): string | null {
  return cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : null;
}
