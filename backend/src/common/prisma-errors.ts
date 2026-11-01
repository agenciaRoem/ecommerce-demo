import { Prisma } from '@prisma/client';

/** `true` si el error es una violación de unicidad (P2002); opcionalmente sobre un campo concreto. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  return String(error.meta?.target ?? '').includes(field);
}
