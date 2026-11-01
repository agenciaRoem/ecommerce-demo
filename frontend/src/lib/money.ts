/**
 * Interpreta un importe escrito a mano: "1500,50", "1500.50" o "1.500,50".
 * Devuelve el número, o `null` si no es un importe positivo con hasta 2 decimales.
 */
export function parseMoney(input: string): number | null {
  const text = input.trim();
  // Con coma decimal, los puntos son separadores de miles.
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 ? value : null;
}

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const currencyNoCents = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export const formatMoney = (value: string | number) => currency.format(Number(value));

/** Para tarjetas de producto: omite los centavos cuando son ",00". */
export function formatPrice(value: string | number): string {
  const amount = Number(value);
  return Number.isInteger(amount) ? currencyNoCents.format(amount) : currency.format(amount);
}
