export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: ApiIssue[] = [],
    /** Cuerpo completo de la respuesta, para errores con datos propios (p. ej. los faltantes de stock). */
    readonly details: unknown = null,
  ) {
    super(message);
  }
}

/** Quién hace la llamada: el personal (panel interno) o un cliente de la tienda. Cada uno renueva su propia sesión. */
export type Audience = 'staff' | 'customer';

const REFRESH_PATH: Record<Audience, string> = {
  staff: '/auth/refresh',
  customer: '/customers/auth/refresh',
};

/** Disparado cuando la sesión del cliente se renovó sola, para que el servidor vuelva a renderizar con sus precios. */
export const CUSTOMER_SESSION_RENEWED = 'customer-session-renewed';

type RequestOptions = Omit<RequestInit, 'body'> & {
  audience?: Audience;
  /** Cuerpo JSON. Para archivos usar `body: FormData`. */
  json?: unknown;
  body?: FormData;
};

/** Renovaciones simultáneas de una misma audiencia comparten una sola llamada de refresh. */
const refreshing: Partial<Record<Audience, Promise<boolean>>> = {};

function refreshSession(audience: Audience): Promise<boolean> {
  refreshing[audience] ??= fetch(`${API_URL}${REFRESH_PATH[audience]}`, { method: 'POST', credentials: 'include' })
    .then((res) => {
      if (res.ok && audience === 'customer') window.dispatchEvent(new Event(CUSTOMER_SESSION_RENEWED));
      return res.ok;
    })
    .catch(() => false)
    .finally(() => {
      delete refreshing[audience];
    });
  return refreshing[audience]!;
}

/** Los endpoints de autenticación no reintentan con refresh: un 401 ahí es una respuesta, no una sesión vencida. */
const isAuthPath = (path: string) => /^\/(auth|customers\/auth|customers\/register)(\/|$)/.test(path);

async function toApiError(res: Response): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as { message?: unknown; errors?: ApiIssue[] } | null;
  const message = typeof data?.message === 'string' ? data.message : 'Ocurrió un error inesperado';
  return new ApiError(res.status, message, data?.errors, data);
}

export async function api<T>(path: string, { json, audience = 'staff', ...init }: RequestOptions = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: json === undefined ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
      body: json === undefined ? init.body : JSON.stringify(json),
    });

  let res = await send();
  // Access token vencido: se renueva la sesión una vez y se reintenta.
  if (res.status === 401 && !isAuthPath(path) && (await refreshSession(audience))) {
    res = await send();
  }
  if (!res.ok) throw await toApiError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
