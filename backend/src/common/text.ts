import { z } from 'zod';

/** Caracteres de control salvo tabulación, salto de línea y retorno (PostgreSQL rechaza incluso el NUL). */
// Rechazar caracteres de control es justamente el objetivo de esta expresión.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const hasNoControlChars = (value: string): boolean => !CONTROL_CHARS.test(value);

const REJECTION = 'Contiene caracteres no permitidos';

/** Texto libre acotado: recortado, con largo mínimo/máximo y sin caracteres de control. */
export const plainText = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine(hasNoControlChars, REJECTION);

/** Texto de búsqueda de los listados. */
export const searchText = () => plainText(1, 80);
