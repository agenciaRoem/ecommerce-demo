import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MP_TOKEN } from './constants';

interface MockPayment {
  id: number | string;
  status: string;
  external_reference: string;
  amount: number;
  currency?: string;
}

/**
 * Servidor que imita los endpoints de Mercado Pago que usa el backend. El estado se maneja por HTTP
 * (`/__payments`, `/__reset`, `/__fail`) porque corre en otro proceso que las pruebas.
 */
export function startMockMercadoPago(port: number): Promise<Server> {
  const payments = new Map<string, MockPayment>();
  let failPreferences = false;

  const toApi = (p: MockPayment) => ({
    id: p.id,
    status: p.status,
    status_detail: p.status === 'approved' ? 'accredited' : 'cc_rejected_other_reason',
    external_reference: p.external_reference,
    transaction_amount: p.amount,
    currency_id: p.currency ?? 'ARS',
  });

  const handle = (req: IncomingMessage, res: ServerResponse, raw: string) => {
    const url = new URL(req.url ?? '/', 'http://mock');
    // Mercado Pago manda JSON; el token de Google llega como formulario (se lee más abajo).
    let body: Record<string, unknown> | null = null;
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      body = null;
    }
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    };

    // Google simulado: el "código" que recibe es el propio perfil (JSON en base64url) que armó la prueba.
    if (url.pathname === '/google/token' && req.method === 'POST') {
      const form = new URLSearchParams(raw);
      if (form.get('client_secret') !== GOOGLE_CLIENT_SECRET || form.get('grant_type') !== 'authorization_code') return send(401, { error: 'invalid_client' });
      let profile: Record<string, unknown>;
      try {
        profile = JSON.parse(Buffer.from(form.get('code') ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
      } catch {
        return send(400, { error: 'invalid_grant' });
      }
      // PKCE: el verificador que manda el backend tiene que corresponder al desafío con el que arrancó el ingreso.
      const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
      if (profile.code_challenge !== challenge) return send(400, { error: 'invalid_grant', error_description: 'PKCE' });
      const { code_challenge: _ignored, ...claims } = profile;
      const payload = { iss: 'https://accounts.google.com', aud: GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 300, ...claims };
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      return send(200, { access_token: 'x', id_token: `${encode({ alg: 'RS256' })}.${encode(payload)}.firma` });
    }

    if (url.pathname === '/__reset') {
      payments.clear();
      failPreferences = false;
      return send(200, { ok: true });
    }
    if (url.pathname === '/__fail') {
      failPreferences = Boolean(body?.on);
      return send(200, { failPreferences });
    }
    if (url.pathname === '/__payments' && req.method === 'POST') {
      payments.set(String((body as unknown as MockPayment).id), body as unknown as MockPayment);
      return send(200, { ok: true });
    }

    if (req.headers.authorization !== `Bearer ${MP_TOKEN}`) return send(401, { message: 'invalid_token', status: 401 });
    if (url.pathname === '/users/me') return send(200, { id: 777000111, nickname: 'TESTUSER_E2E', email: 'test@testuser.com', site_id: 'MLA' });

    if (url.pathname === '/checkout/preferences' && req.method === 'POST') {
      if (failPreferences) return send(500, { message: 'internal error' });
      const id = `pref-${Math.random().toString(36).slice(2, 10)}`;
      return send(201, {
        id,
        init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${id}`,
        sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=${id}`,
      });
    }
    if (url.pathname === '/v1/payments/search') {
      const ref = url.searchParams.get('external_reference');
      return send(200, { results: [...payments.values()].filter((p) => p.external_reference === ref).reverse().map(toApi) });
    }
    const match = url.pathname.match(/^\/v1\/payments\/(\d+)$/);
    if (match) {
      const payment = payments.get(match[1]);
      return payment ? send(200, toApi(payment)) : send(404, { message: 'Payment not found', status: 404 });
    }
    return send(404, { message: 'not found' });
  };

  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => handle(req, res, raw));
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
