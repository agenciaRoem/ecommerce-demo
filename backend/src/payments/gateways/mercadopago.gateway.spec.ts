import type { Env } from '../../config/env.validation';
import { GatewayError } from './payment-gateway';
import { MercadoPagoGateway } from './mercadopago.gateway';

const gateway = new MercadoPagoGateway({ MERCADOPAGO_API_URL: 'https://mp.test' } as Env);
const credentials = { accessToken: 'APP_USR-token-super-secreto', mode: 'SANDBOX' as const };

const respond = (status: number, body: unknown = {}) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => jest.restoreAllMocks());

describe('MercadoPagoGateway', () => {
  it('valida las credenciales con GET /users/me y devuelve la cuenta', async () => {
    const fetchMock = respond(200, { id: 777, nickname: 'TIENDA_DEMO', site_id: 'MLA' });

    await expect(gateway.verifyCredentials(credentials)).resolves.toEqual({ id: '777', label: 'TIENDA_DEMO', siteId: 'MLA' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mp.test/users/me');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer APP_USR-token-super-secreto');
  });

  it.each([401, 403])('mapea el HTTP %i a credenciales inválidas', async (status) => {
    respond(status, { message: 'invalid_token' });
    await expect(gateway.verifyCredentials(credentials)).rejects.toMatchObject({ kind: 'invalid_credentials' });
  });

  it('mapea un 5xx y un corte de red a "no disponible"', async () => {
    respond(503);
    await expect(gateway.verifyCredentials(credentials)).rejects.toMatchObject({ kind: 'unavailable' });

    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(gateway.verifyCredentials(credentials)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('nunca incluye el token en los mensajes de error', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('boom APP_USR-token-super-secreto'));
    const error = (await gateway.verifyCredentials(credentials).catch((e: unknown) => e)) as GatewayError;
    expect(error.message).not.toContain('APP_USR');
  });

  describe('createCheckout', () => {
    const request = {
      reference: 'pedido-1',
      items: [{ id: 'p1', title: 'Cuaderno', quantity: 2, unitPrice: 2880 }],
      successUrl: 'https://tienda.com/ok',
      pendingUrl: 'https://tienda.com/pendiente',
      failureUrl: 'https://tienda.com/error',
      notificationUrl: 'https://api.tienda.com/payments/webhooks/mercadopago',
    };
    const preference = { id: 'pref-1', init_point: 'https://mp/prod', sandbox_init_point: 'https://mp/sandbox' };

    it('crea la preferencia con la referencia, las URLs y la idempotencia del pedido', async () => {
      const fetchMock = respond(201, preference);
      await gateway.createCheckout(credentials, request);

      const [url, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init!.body as string);
      expect(url).toBe('https://mp.test/checkout/preferences');
      expect(body).toMatchObject({
        external_reference: 'pedido-1',
        notification_url: request.notificationUrl,
        items: [{ id: 'p1', quantity: 2, unit_price: 2880, currency_id: 'ARS' }],
        back_urls: { success: request.successUrl, pending: request.pendingUrl, failure: request.failureUrl },
        auto_return: 'approved',
      });
      expect((init!.headers as Record<string, string>)['X-Idempotency-Key']).toBe('pedido-1');
    });

    it('no ofrece pagos en efectivo: tardan más que la reserva de stock', async () => {
      const fetchMock = respond(201, preference);
      await gateway.createCheckout(credentials, request);
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).payment_methods).toEqual({
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
      });
    });

    it('usa el enlace de pruebas en modo SANDBOX y el real en PRODUCTION', async () => {
      respond(201, preference);
      expect((await gateway.createCheckout(credentials, request)).url).toBe('https://mp/sandbox');
      respond(201, preference);
      expect((await gateway.createCheckout({ ...credentials, mode: 'PRODUCTION' }, request)).url).toBe('https://mp/prod');
    });

    it('no pide regreso automático con una URL de éxito que no es HTTPS (Mercado Pago la rechaza)', async () => {
      const fetchMock = respond(201, preference);
      await gateway.createCheckout(credentials, { ...request, successUrl: 'http://localhost:3000/ok' });
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).not.toHaveProperty('auto_return');
    });
  });

  it('consulta un pago y lo normaliza', async () => {
    respond(200, { id: 55, status: 'approved', status_detail: 'accredited', external_reference: 'pedido-1', transaction_amount: 5760, currency_id: 'ARS' });
    await expect(gateway.getPayment(credentials, '55')).resolves.toEqual({
      id: '55',
      status: 'approved',
      statusDetail: 'accredited',
      reference: 'pedido-1',
      amount: 5760,
      currency: 'ARS',
    });
  });
});

describe('MercadoPagoGateway.searchPayments', () => {
  afterEach(() => jest.restoreAllMocks());

  it('busca por la referencia del pedido, del más nuevo al más viejo', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: 9, status: 'approved', external_reference: 'pedido-1', transaction_amount: 100, currency_id: 'ARS' }] }), { status: 200 }),
    );
    const payments = await gateway.searchPayments(credentials, 'pedido-1');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v1/payments/search');
    expect(url.searchParams.get('external_reference')).toBe('pedido-1');
    expect(url.searchParams.get('criteria')).toBe('desc');
    expect(payments).toEqual([{ id: '9', status: 'approved', statusDetail: null, reference: 'pedido-1', amount: 100, currency: 'ARS' }]);
  });

  it('sin resultados devuelve una lista vacía', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await expect(gateway.searchPayments(credentials, 'x')).resolves.toEqual([]);
  });
});
