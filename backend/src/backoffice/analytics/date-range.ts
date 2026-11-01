import { z } from 'zod';

export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && toIso(new Date(`${value}T00:00:00Z`)) === value, 'Fecha inexistente');

/** Rango pedido por el cliente. Ambos extremos son opcionales; las fechas son del día local del negocio. */
export const dateRangeSchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export interface DateRange {
  /** Primer día incluido (AAAA-MM-DD, hora local del negocio). */
  from: string;
  /** Último día incluido. */
  to: string;
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const addDays = (day: string, amount: number): string => toIso(new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS));

const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

/** La fecha de hoy en la zona horaria del negocio (el servidor puede estar en UTC). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Completa y valida el rango: por defecto los últimos 30 días hasta hoy; nunca más de un año ni en el futuro. */
export function resolveRange(input: { from?: string; to?: string }, today: string): DateRange {
  const to = input.to ?? today;
  const from = input.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (from > to) throw new RangeError('La fecha inicial es posterior a la final');
  if (to > today) throw new RangeError('El rango no puede terminar en el futuro');
  const days = daysBetween(from, to);
  if (days > MAX_RANGE_DAYS) throw new RangeError(`El rango admite hasta ${MAX_RANGE_DAYS} días`);
  return { from, to, days };
}

/** El período inmediatamente anterior y de igual duración, para comparar. */
export function previousRange(range: DateRange): DateRange {
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(range.days - 1)), to, days: range.days };
}

/** Todos los días del rango, para completar con ceros los días sin ventas. */
export function eachDay(range: DateRange): string[] {
  return Array.from({ length: range.days }, (_, i) => addDays(range.from, i));
}
