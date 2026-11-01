/**
 * Destino al que volver después de ingresar (`?volver=/productos/…`). Solo se aceptan rutas internas:
 * una URL externa o con doble barra permitiría llevar al cliente a otro sitio tras iniciar sesión.
 */
export function safeReturnPath(value: string | string[] | undefined, fallback = '/cuenta'): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || candidate.length > 300) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  return candidate;
}

/** Enlace a la pantalla de ingreso que, al terminar, devuelve al cliente a `path`. */
export const loginHref = (path: string) => `/cuenta/ingresar?volver=${encodeURIComponent(path)}`;
export const registerHref = (path: string) => `/cuenta/registro?volver=${encodeURIComponent(path)}`;
