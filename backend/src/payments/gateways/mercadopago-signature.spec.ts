import { createHmac } from 'node:crypto';
import { signMercadoPagoNotification, verifyMercadoPagoSignature } from './mercadopago-signature';

const secret = 'a'.repeat(64);
const base = { secret, requestId: 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e', dataId: '123456' };
const ts = '1742505638683';

describe('verifyMercadoPagoSignature', () => {
  it('acepta una firma calculada con la plantilla documentada', () => {
    // Misma cuenta que describe la documentación: HMAC-SHA256 hex de "id:..;request-id:..;ts:..;".
    const v1 = createHmac('sha256', secret).update(`id:123456;request-id:${base.requestId};ts:${ts};`).digest('hex');
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: `ts=${ts},v1=${v1}` })).toBe(true);
  });

  it('acepta la firma que genera nuestro simulador', () => {
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: signMercadoPagoNotification({ ...base, ts }) })).toBe(true);
  });

  it('rechaza una clave secreta distinta', () => {
    const header = signMercadoPagoNotification({ ...base, ts });
    expect(verifyMercadoPagoSignature({ ...base, secret: 'b'.repeat(64), signatureHeader: header })).toBe(false);
  });

  it.each([
    ['otro data.id', { dataId: '999999' }],
    ['otro x-request-id', { requestId: 'otro' }],
  ])('rechaza si cambia %s (no se puede reutilizar la firma)', (_, change) => {
    const header = signMercadoPagoNotification({ ...base, ts });
    expect(verifyMercadoPagoSignature({ ...base, ...change, signatureHeader: header })).toBe(false);
  });

  it('rechaza si cambia el timestamp', () => {
    const header = signMercadoPagoNotification({ ...base, ts });
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: header.replace(ts, '1742505638684') })).toBe(false);
  });

  it('omite de la plantilla los datos que no llegaron', () => {
    const noRequestId = { ...base, requestId: undefined };
    const v1 = createHmac('sha256', secret).update(`id:123456;ts:${ts};`).digest('hex');
    expect(verifyMercadoPagoSignature({ ...noRequestId, signatureHeader: `ts=${ts},v1=${v1}` })).toBe(true);
  });

  it('acepta data.id alfanumérico firmado en minúsculas', () => {
    const input = { ...base, dataId: 'ABC123' };
    const header = signMercadoPagoNotification({ ...input, dataId: 'abc123', ts });
    expect(verifyMercadoPagoSignature({ ...input, signatureHeader: header })).toBe(true);
  });

  it.each([undefined, '', 'basura', 'ts=1', 'v1=abc', `ts=${ts},v1=no-es-hex`, `ts=${ts},v1=abcd`])(
    'rechaza el encabezado %j',
    (signatureHeader) => {
      expect(verifyMercadoPagoSignature({ ...base, signatureHeader })).toBe(false);
    },
  );

  it('rechaza si no hay clave configurada', () => {
    expect(verifyMercadoPagoSignature({ ...base, secret: '', signatureHeader: signMercadoPagoNotification({ ...base, ts }) })).toBe(false);
  });
});
