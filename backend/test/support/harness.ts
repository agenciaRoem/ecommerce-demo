import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { APP_CONFIG } from '../../src/config/config.module';
import { Env } from '../../src/config/env.validation';
import { MailMessage, MailService } from '../../src/mail/mail.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ADMIN, DEMO_PASSWORD, MP_TOKEN, MP_URL, MP_WEBHOOK_SECRET } from './constants';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const uniq = (): string => randomBytes(4).toString('hex');

/** Arranca la aplicación real (mismos middlewares que en producción) contra la base de pruebas. */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, app.get<Env>(APP_CONFIG));
  await app.init();
  return app;
}

/**
 * Un navegador de prueba: conserva cookies como un usuario real y se identifica con su propia IP
 * (`X-Forwarded-For`), así el límite de tasa de un cliente no afecta a los demás.
 */
export class Client {
  private readonly agent: ReturnType<typeof request.agent>;
  readonly ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

  constructor(app: INestApplication) {
    this.agent = request.agent(app.getHttpServer());
  }

  private send(method: Method, path: string, body?: object, headers: Record<string, string> = {}) {
    const req = this.agent[method](path).set('X-Forwarded-For', this.ip).set(headers);
    return body ? req.send(body) : req;
  }

  get = (path: string, headers?: Record<string, string>) => this.send('get', path, undefined, headers);
  post = (path: string, body?: object, headers?: Record<string, string>) => this.send('post', path, body, headers);
  put = (path: string, body?: object) => this.send('put', path, body);
  patch = (path: string, body?: object) => this.send('patch', path, body);
  delete = (path: string) => this.send('delete', path);

  async loginStaff(email: string, password: string = DEMO_PASSWORD): Promise<this> {
    const res = await this.post('/auth/login', { email, password });
    if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return this;
  }
}

export async function staffClient(app: INestApplication, email: string, password?: string): Promise<Client> {
  return new Client(app).loginStaff(email, password);
}

export const adminClient = (app: INestApplication) => staffClient(app, ADMIN.email, ADMIN.password);

export interface Fixture {
  prisma: PrismaService;
  cenId: string;
  norId: string;
  categoryId: string;
}

export async function loadFixture(app: INestApplication): Promise<Fixture> {
  const prisma = app.get(PrismaService);
  const [cen, nor, category] = await Promise.all([
    prisma.branch.findUniqueOrThrow({ where: { code: 'CEN' } }),
    prisma.branch.findUniqueOrThrow({ where: { code: 'NOR' } }),
    prisma.category.findUniqueOrThrow({ where: { slug: 'papeleria' } }),
  ]);
  return { prisma, cenId: cen.id, norId: nor.id, categoryId: category.id };
}

/** Alta de un producto con stock en la sucursal del stockeo (CEN). */
export async function createProduct(stockeo: Client, categoryId: string, quantity: number, cost = 700): Promise<{ id: string; name: string }> {
  const name = `E2E ${uniq()}`;
  const res = await stockeo.post('/products', { name, categoryId, cost, quantity });
  if (res.status !== 201) throw new Error(`alta de producto: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.id as string, name };
}

// ───────── Mercado Pago simulado ─────────

export const mock = {
  async post(path: string, body: object = {}): Promise<void> {
    await fetch(`${MP_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  },
  reset: () => mock.post('/__reset'),
  fail: (on: boolean) => mock.post('/__fail', { on }),
  payment: (payment: { id: number; status: string; external_reference: string; amount: number }) => mock.post('/__payments', payment),
};

/** Deja la pasarela lista (credenciales de prueba, activada) como lo haría el superadmin desde el backoffice. */
export async function configureGateway(admin: Client): Promise<void> {
  const res = await admin.put('/admin/payments/mercadopago', { accessToken: MP_TOKEN, webhookSecret: MP_WEBHOOK_SECRET, mode: 'SANDBOX', isEnabled: true });
  if (res.status !== 200 || res.body.ready !== true) throw new Error(`pasarela: ${res.status} ${JSON.stringify(res.body)}`);
}

/** Aviso de pago firmado como lo haría Mercado Pago. */
export function sendWebhook(client: Client, paymentId: number | string, secret = MP_WEBHOOK_SECRET) {
  const requestId = randomUUID();
  const ts = String(Date.now());
  const v1 = createHmac('sha256', secret).update(`id:${paymentId};request-id:${requestId};ts:${ts};`).digest('hex');
  return client.post(`/payments/webhooks/mercadopago?data.id=${paymentId}&type=payment`, { action: 'payment.updated', type: 'payment', live_mode: false }, { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${v1}` });
}

let paymentSeq = Math.floor(Math.random() * 1_000_000) + 1_000_000;
export const nextPaymentId = (): number => ++paymentSeq;

// ───────── Clientes de la tienda ─────────

/** CUIT válido (con dígito verificador) y distinto en cada llamada. */
export function newCuit(): string {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  for (;;) {
    const digits = `30${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const sum = weights.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0);
    const remainder = sum % 11;
    const check = remainder === 0 ? 0 : 11 - remainder;
    if (check !== 10) return `${digits}${check}`;
  }
}

export interface RegisteredCustomer {
  client: Client;
  email: string;
  id: string;
  name: string;
}

// ───────── Correo ─────────

/** Último correo enviado a `email` cuyo cuerpo contiene `fragment`. Espera un momento: el envío no bloquea la respuesta. */
export async function waitForMail(app: INestApplication, email: string, fragment: string): Promise<MailMessage> {
  const { outbox } = app.get(MailService);
  for (let i = 0; i < 40; i++) {
    const mail = [...outbox].reverse().find((message) => message.to === email && (message.text.includes(fragment) || message.subject.includes(fragment)));
    if (mail) return mail;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`No llegó un correo a ${email} con "${fragment}"`);
}

/** Cuántos correos recibió `email` (para comprobar que NO se mandó uno). */
export const mailCount = (app: INestApplication, email: string): number => app.get(MailService).outbox.filter((message) => message.to === email).length;

/** Saca el token del enlace del correo. */
export function tokenFrom(mail: MailMessage): string {
  const match = mail.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error(`El correo no trae un enlace con token:
${mail.text}`);
  return match[1];
}

/** Hace lo que haría el cliente al tocar el enlace de verificación. */
export async function verifyEmailOf(app: INestApplication, email: string): Promise<void> {
  const token = tokenFrom(await waitForMail(app, email, '/cuenta/verificar'));
  const res = await new Client(app).post('/customers/verify-email', { token });
  if (res.status !== 204) throw new Error(`verificación: ${res.status} ${JSON.stringify(res.body)}`);
}

export async function registerCustomer(
  app: INestApplication,
  type: 'RETAIL' | 'COMMERCE' = 'RETAIL',
  options: { verify?: boolean } = {},
): Promise<RegisteredCustomer> {
  const client = new Client(app);
  const tag = uniq();
  const email = `cliente.${tag}@e2e.test`;
  const body =
    type === 'RETAIL'
      ? { type, email, password: 'clave-segura-123', fullName: `Cliente ${tag}`, phone: '11 4444-5555' }
      : { type, email, password: 'clave-segura-123', fullName: `Contacto ${tag}`, phone: '11 4444-5555', businessName: `Comercio ${tag} SRL`, cuit: newCuit(), shippingAddress: 'Av. Siempre Viva 742' };
  const res = await client.post('/customers/register', body);
  if (res.status !== 201) throw new Error(`registro: ${res.status} ${JSON.stringify(res.body)}`);
  // Para comprar hace falta el email verificado: salvo que la prueba quiera lo contrario, se verifica como lo haría el cliente.
  if (options.verify !== false) await verifyEmailOf(app, email);
  return { client, email, id: res.body.id as string, name: body.fullName };
}

/** Compra de punta a punta: carrito → checkout → pago aprobado en Mercado Pago → aviso firmado. Devuelve el pedido. */
export async function buyAndPay(
  app: INestApplication,
  customer: RegisteredCustomer,
  options: { productId: string; branchId: string; quantity?: number; delivery?: 'PICKUP' | 'SHIPPING' },
): Promise<{ orderId: string; total: number }> {
  const { client } = customer;
  await client.delete('/cart');
  await client.post('/cart/items', { productId: options.productId, quantity: options.quantity ?? 1 });
  const checkout = await client.post('/checkout', { deliveryMethod: options.delivery ?? 'PICKUP', branchId: options.branchId });
  if (checkout.status !== 201) throw new Error(`checkout: ${checkout.status} ${JSON.stringify(checkout.body)}`);
  const orderId = checkout.body.order.id as string;
  const total = Number(checkout.body.order.total);

  const paymentId = nextPaymentId();
  await mock.payment({ id: paymentId, status: 'approved', external_reference: orderId, amount: total });
  const webhook = await sendWebhook(new Client(app), paymentId);
  if (webhook.status !== 200) throw new Error(`webhook: ${webhook.status} ${JSON.stringify(webhook.body)}`);
  return { orderId, total };
}
