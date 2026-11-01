/** El SUPERADMIN indica la sucursal con `?branchId=`; el resto queda fijado a la suya por el servidor. */
export const withBranch = (path: string, branchId?: string): string =>
  branchId ? `${path}${path.includes('?') ? '&' : '?'}branchId=${branchId}` : path;

/** Arma una query string omitiendo lo vacío. */
export function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
