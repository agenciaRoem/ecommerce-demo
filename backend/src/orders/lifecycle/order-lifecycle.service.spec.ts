import { Prisma } from '@prisma/client';
import { OrderLifecycleService } from './order-lifecycle.service';

const unique = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError('duplicado', { code: 'P2002', clientVersion: 'test', meta: { target } });

function setup(transaction: () => Promise<unknown>) {
  const prisma = {
    $transaction: jest.fn(transaction),
    order: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () => [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }]),
    },
  };
  const audit = { record: jest.fn(async () => undefined) };
  const service = new OrderLifecycleService(prisma as never, {} as never, audit as never);
  return { service, prisma, audit };
}

describe('OrderLifecycleService.markPaid', () => {
  it('un pago ya usado por otro pedido se marca para revisar y NO es un error (la pasarela no reintenta)', async () => {
    const { service, prisma, audit } = setup(async () => {
      throw unique(['payment_provider', 'payment_id']);
    });
    await expect(service.markPaid('o1', { id: '900', status: 'approved' })).resolves.toBe('payment_already_used');
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { paymentIssue: expect.stringContaining('900') } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.payment_issue', entityId: 'o1' }));
  });

  it('otros errores de la base sí se propagan (la pasarela reintentará)', async () => {
    const { service } = setup(async () => {
      throw new Error('conexión perdida');
    });
    await expect(service.markPaid('o1', { id: '900', status: 'approved' })).rejects.toThrow('conexión perdida');
  });

  it('una violación de unicidad en otro campo no se disfraza de pago repetido', async () => {
    const { service } = setup(async () => {
      throw unique(['number']);
    });
    await expect(service.markPaid('o1', { id: '900', status: 'approved' })).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});

describe('OrderLifecycleService.expireDue', () => {
  it('cuenta los pedidos liberados y sigue aunque uno falle', async () => {
    const { service } = setup(async () => true);
    const cancel = jest.spyOn(service, 'cancel');
    cancel.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(false);

    await expect(service.expireDue()).resolves.toBe(1);
    expect(cancel).toHaveBeenCalledTimes(3);
  });

  it('solo busca pedidos pendientes de pago cuyo plazo ya venció', async () => {
    const { service, prisma } = setup(async () => true);
    await service.expireDue(10);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING_PAYMENT', expiresAt: { lte: expect.any(Date) } }, take: 10 }),
    );
  });
});
