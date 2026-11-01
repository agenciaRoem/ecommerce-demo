/** Sucursal elegida para retirar. Cookie no sensible y legible por el servidor (ver `store-api.ts`). */
export const BRANCH_COOKIE = 'branch';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function writeBranchCookie(branchId: string | null): void {
  document.cookie = branchId
    ? `${BRANCH_COOKIE}=${branchId}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    : `${BRANCH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Sucursal elegida en la cabecera (solo en el navegador). */
export function readBranchCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${BRANCH_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(BRANCH_COOKIE.length + 1)) || null : null;
}
