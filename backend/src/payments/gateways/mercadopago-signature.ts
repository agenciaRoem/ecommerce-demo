import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MercadoPagoSignatureInput {
  /** Clave secreta de la aplicación (Tus integraciones → Webhooks). */
  secret: string;
  /** Encabezado `x-signature`: `ts=<milisegundos>,v1=<firma>`. */
  signatureHeader: string | undefined;
  /** Encabezado `x-request-id`. */
  requestId: string | undefined;
  /** Parámetro `data.id` de la URL de la notificación. */
  dataId: string | undefined;
}

function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, value.join('=')];
    }),
  ) as Record<string, string>;
  return { ts: parts.ts, v1: parts.v1 };
}

/** Plantilla firmada: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo los datos que no llegaron. */
const buildManifest = (dataId: string | undefined, requestId: string | undefined, ts: string) =>
  `${dataId ? `id:${dataId};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${ts};`;

const hmac = (secret: string, manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

/**
 * Comprueba que una notificación realmente la envió Mercado Pago (HMAC-SHA256 en hexadecimal con la clave
 * secreta de la aplicación). Sin esto cualquiera podría avisar "pagado" a la URL pública del webhook.
 * La comparación es de tiempo constante.
 */
export function verifyMercadoPagoSignature({ secret, signatureHeader, requestId, dataId }: MercadoPagoSignatureInput): boolean {
  if (!signatureHeader || !secret) return false;
  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;

  // Un `data.id` alfanumérico puede firmarse en minúsculas; los de pagos son numéricos y no cambian.
  const candidates = new Set([dataId, dataId?.toLowerCase()]);
  const received = Buffer.from(v1.toLowerCase(), 'hex');

  for (const candidate of candidates) {
    const expected = Buffer.from(hmac(secret, buildManifest(candidate, requestId, ts)), 'hex');
    if (expected.length === received.length && timingSafeEqual(expected, received)) return true;
  }
  return false;
}

/** Genera una firma válida. Solo para pruebas y para el simulador de notificaciones. */
export function signMercadoPagoNotification(input: Omit<MercadoPagoSignatureInput, 'signatureHeader'> & { ts: string }): string {
  return `ts=${input.ts},v1=${hmac(input.secret, buildManifest(input.dataId, input.requestId, input.ts))}`;
}
