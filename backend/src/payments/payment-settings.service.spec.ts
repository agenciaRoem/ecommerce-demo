import { ConflictException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import type { PaymentGateway as GatewayRecord } from '@prisma/client';
import type { Env } from '../config/env.validation';
import { SecretBox } from '../crypto/secret-box.service';
import { GatewayError } from './gateways/payment-gateway';
import { PaymentSettingsService } from './payment-settings.service';

const TOKEN = 'APP_USR-1234567890-abcdef-secret-9876';
const SECRET = 'f'.repeat(64);

function setup(options: { verify?: () => Promise<unknown> } = {}) {
  const box = new SecretBox({ SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64') } as Env);
  let row: GatewayRecord | null = null;

  const prisma = {
    paymentGateway: {
      findUnique: jest.fn(async () => row),
      create: jest.fn(async ({ data }: { data: Partial<GatewayRecord> }) => {
        row = { id: 'g1', createdAt: new Date(), updatedAt: new Date(), isEnabled: false, mode: 'SANDBOX', ...data } as GatewayRecord;
        return row;
      }),
      update: jest.fn(async ({ data }: { data: Partial<GatewayRecord> }) => {
        row = { ...row!, ...data, updatedAt: new Date() };
        return row;
      }),
    },
  };
  const mercadoPago = { verifyCredentials: jest.fn(options.verify ?? (async () => ({ id: '777', label: 'TIENDA_DEMO', siteId: 'MLA' }))) };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new PaymentSettingsService(
    prisma as never,
    box,
    mercadoPago as never,
    audit as never,
    { PUBLIC_API_URL: 'https://api.tienda.com' } as Env,
  );
  return { service, prisma, mercadoPago, audit, row: () => row };
}

const actor = { id: 'admin-1', ip: '1.2.3.4' };

describe('PaymentSettingsService', () => {
  it('sin configurar: vista vacía y URL del webhook lista para copiar', async () => {
    const { service } = setup();
    expect(await service.getView()).toMatchObject({
      isEnabled: false,
      ready: false,
      hasAccessToken: false,
      accessTokenHint: null,
      account: null,
      mode: 'SANDBOX',
      webhookUrl: 'https://api.tienda.com/payments/webhooks/mercadopago',
    });
  });

  it('valida el token ANTES de guardarlo y lo guarda cifrado', async () => {
    const { service, mercadoPago, row } = setup();
    const view = await service.update({ accessToken: TOKEN, webhookSecret: SECRET }, actor);

    expect(mercadoPago.verifyCredentials).toHaveBeenCalledWith({ accessToken: TOKEN, mode: 'SANDBOX' });
    expect(row()!.accessTokenEnc).toMatch(/^v1\./);
    expect(row()!.accessTokenEnc).not.toContain('APP_USR');
    expect(row()!.webhookSecretEnc).not.toContain(SECRET);
    expect(view.account).toEqual({ id: '777', label: 'TIENDA_DEMO', siteId: 'MLA' });
  });

  it('la vista nunca expone los secretos, solo los últimos 4 caracteres', async () => {
    const { service } = setup();
    const view = await service.update({ accessToken: TOKEN, webhookSecret: SECRET, publicKey: 'APP_USR-public-key-1234567890' }, actor);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(SECRET);
    expect(view.accessTokenHint).toBe('••••9876');
    expect(view.webhookSecretHint).toBe('••••ffff');
    expect(view.publicKey).toBe('APP_USR-public-key-1234567890'); // la Public Key no es secreta
  });

  it('un token rechazado por Mercado Pago no se guarda', async () => {
    const { service, prisma } = setup({
      verify: async () => {
        throw new GatewayError('x', 'invalid_credentials');
      },
    });
    await expect(service.update({ accessToken: TOKEN }, actor)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.paymentGateway.create).not.toHaveBeenCalled();
    expect(prisma.paymentGateway.update).not.toHaveBeenCalled();
  });

  it('si Mercado Pago no responde, avisa que es transitorio (503)', async () => {
    const { service } = setup({
      verify: async () => {
        throw new GatewayError('x', 'unavailable');
      },
    });
    await expect(service.update({ accessToken: TOKEN }, actor)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe('activar los cobros', () => {
    it('exige Access Token', async () => {
      const { service } = setup();
      await expect(service.update({ isEnabled: true }, actor)).rejects.toThrow(/Access Token/);
    });

    it('exige la clave secreta del webhook (sin ella no se pueden confirmar los pagos)', async () => {
      const { service } = setup();
      await service.update({ accessToken: TOKEN }, actor);
      await expect(service.update({ isEnabled: true }, actor)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.update({ isEnabled: true }, actor)).rejects.toThrow(/clave secreta/);
    });

    it('se activa cuando está todo validado', async () => {
      const { service } = setup();
      await service.update({ accessToken: TOKEN, webhookSecret: SECRET }, actor);
      const view = await service.update({ isEnabled: true }, actor);
      expect(view).toMatchObject({ isEnabled: true, ready: true });
    });

    it('se puede cargar todo y activar en un solo paso', async () => {
      const { service } = setup();
      const view = await service.update({ accessToken: TOKEN, webhookSecret: SECRET, isEnabled: true }, actor);
      expect(view.ready).toBe(true);
    });
  });

  it('cambiar de Access Token desactiva los cobros: hay que reactivar a propósito', async () => {
    const { service } = setup();
    await service.update({ accessToken: TOKEN, webhookSecret: SECRET, isEnabled: true }, actor);
    const view = await service.update({ accessToken: 'APP_USR-otra-cuenta-1234567890-zzzz' }, actor);
    expect(view.isEnabled).toBe(false);
  });

  it('un cambio que no toca los secretos los conserva', async () => {
    const { service, row } = setup();
    await service.update({ accessToken: TOKEN, webhookSecret: SECRET }, actor);
    const before = row()!.accessTokenEnc;
    await service.update({ mode: 'PRODUCTION' }, actor);
    expect(row()!.accessTokenEnc).toBe(before);
    expect(row()!.mode).toBe('PRODUCTION');
  });

  it('verify: credenciales que dejan de servir frenan los cobros y guardan el motivo', async () => {
    const state = setup();
    await state.service.update({ accessToken: TOKEN, webhookSecret: SECRET, isEnabled: true }, actor);
    state.mercadoPago.verifyCredentials.mockRejectedValue(new GatewayError('x', 'invalid_credentials'));

    const { ok, view } = await state.service.verify(actor);
    expect(ok).toBe(false);
    expect(view.isEnabled).toBe(false);
    expect(view.lastError).toMatch(/rechazó el Access Token/);
  });

  it('verify sin credenciales cargadas informa el problema', async () => {
    await expect(setup().service.verify(actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('getActive: solo entrega credenciales con los cobros activos', async () => {
    const { service } = setup();
    await service.update({ accessToken: TOKEN, webhookSecret: SECRET }, actor);
    expect(await service.getActive()).toBeNull();
    await service.update({ isEnabled: true }, actor);
    expect(await service.getActive()).toEqual({ accessToken: TOKEN, mode: 'SANDBOX', webhookSecret: SECRET });
  });

  it('desconectar borra los secretos y desactiva', async () => {
    const { service, row } = setup();
    await service.update({ accessToken: TOKEN, webhookSecret: SECRET, isEnabled: true }, actor);
    const view = await service.disconnect(actor);
    expect(row()).toMatchObject({ accessTokenEnc: null, webhookSecretEnc: null, isEnabled: false });
    expect(view).toMatchObject({ hasAccessToken: false, ready: false });
  });

  it('audita cada cambio sin incluir secretos', async () => {
    const { service, audit } = setup();
    await service.update({ accessToken: TOKEN, webhookSecret: SECRET }, actor);

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'payment_gateway.updated', actorId: 'admin-1', ip: '1.2.3.4' }));
    const logged = JSON.stringify(audit.record.mock.calls);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain('accessToken'); // se registra QUÉ cambió, no el valor
  });
});
