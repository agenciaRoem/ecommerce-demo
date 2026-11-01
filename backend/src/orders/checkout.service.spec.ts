import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { Env } from '../config/env.validation';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import { CheckoutService } from './checkout.service';
import type { CheckoutDto } from './orders.schemas';

const BRANCH = '7c76461f-4bf7-4cdb-9623-1bb58b22c87a';
const retail: AuthenticatedCustomer = { id: 'c1', type: 'RETAIL', verified: false };
const commerce: AuthenticatedCustomer = { id: 'c2', type: 'COMMERCE', verified: true };
const pickup: CheckoutDto = { deliveryMethod: 'PICKUP', branchId: BRANCH };
const shipping: CheckoutDto = { deliveryMethod: 'SHIPPING', branchId: BRANCH };

interface Setup {
  gateway?: { mode: 'SANDBOX' | 'PRODUCTION' } | null;
  profile?: { type: 'RETAIL' | 'COMMERCE'; shippingAddress: string | null };
  cartLines?: { productId: string; quantity: number }[];
  branchExists?: boolean;
}

function setup({ gateway = { mode: 'SANDBOX' }, profile = { type: 'RETAIL', shippingAddress: null }, cartLines = [{ productId: 'p1', quantity: 1 }], branchExists = true }: Setup = {}) {
  const prisma = {
    customer: { findUnique: jest.fn(async () => ({ ...profile, email: 'a@b.com', isActive: true })) },
    branch: { findFirst: jest.fn(async () => (branchExists ? { id: BRANCH } : null)) },
    order: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  const cart = { lines: jest.fn(async () => cartLines) };
  const settings = { getActive: jest.fn(async () => gateway) };
  const mercadoPago = { createCheckout: jest.fn() };
  const lifecycle = { cancel: jest.fn(async () => true) };
  const service = new CheckoutService(
    prisma as never,
    cart as never,
    {} as never,
    {} as never,
    lifecycle as never,
    settings as never,
    mercadoPago as never,
    {} as never,
    { ORDER_PAYMENT_WINDOW_MINUTES: 30, PUBLIC_STORE_URL: 'https://tienda.com', PUBLIC_API_URL: 'https://api.tienda.com' } as Env,
  );
  return { service, prisma, mercadoPago, lifecycle };
}

describe('CheckoutService: reglas de retiro y envío', () => {
  it('un minorista NO puede pedir envío a domicilio', async () => {
    const { service, prisma } = setup();
    await expect(service.checkout(retail, shipping)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled(); // no se reservó nada
  });

  it('opciones de entrega: minorista solo retiro, comercio retiro o envío', async () => {
    expect((await setup().service.options(retail)).deliveryMethods).toEqual(['PICKUP']);
    expect((await setup({ profile: { type: 'COMMERCE', shippingAddress: 'Av. 1' } }).service.options(commerce)).deliveryMethods).toEqual(['PICKUP', 'SHIPPING']);
  });

  it('las opciones informan si los cobros están activos y si es modo prueba', async () => {
    expect(await setup({ gateway: null }).service.options(retail)).toMatchObject({ paymentsEnabled: false, testMode: false });
    expect(await setup().service.options(retail)).toMatchObject({ paymentsEnabled: true, testMode: true });
    expect(await setup({ gateway: { mode: 'PRODUCTION' } }).service.options(retail)).toMatchObject({ testMode: false });
  });

  it('un comercio que pide envío sin dirección (ni guardada ni indicada) es rechazado', async () => {
    const { service, prisma } = setup({ profile: { type: 'COMMERCE', shippingAddress: null } });
    await expect(service.checkout(commerce, shipping)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sin pasarela activa no se puede comprar', async () => {
    const { service, prisma } = setup({ gateway: null });
    await expect(service.checkout(retail, pickup)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('carrito vacío o sucursal inexistente son errores del cliente (400)', async () => {
    await expect(setup({ cartLines: [] }).service.checkout(retail, pickup)).rejects.toBeInstanceOf(BadRequestException);
    await expect(setup({ branchExists: false }).service.checkout(retail, pickup)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('si Mercado Pago falla, el pedido se cancela (se libera el stock) y el cliente puede reintentar', async () => {
    const { service, prisma, mercadoPago, lifecycle } = setup();
    prisma.$transaction.mockResolvedValue({ id: 'order-1', items: [{ productId: 'p1', name: 'X', quantity: 1, unitPrice: { sub: () => ({ toFixed: () => '10.00' }) }, discountAmount: 0 }] });
    mercadoPago.createCheckout.mockRejectedValue(new Error('boom'));

    await expect(service.checkout(retail, pickup)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(lifecycle.cancel).toHaveBeenCalledWith('order-1', 'payment_unavailable');
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
