import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService workflow safeguards', () => {
  let prisma: any;
  let service: OrdersService;

  beforeEach(() => {
    prisma = { $transaction: jest.fn() };
    service = new OrdersService(prisma as PrismaService);
  });

  it('does not create a service order from an address owned by another customer', async () => {
    const tx = {
      customerAddress: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceOrder: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (value: any) => unknown) => callback(tx));

    await expect(service.createCustomerOrder('customer-a', {
      addressId: 'address-b',
      categoryId: 'category-1',
      description: 'Consertar uma torneira com vazamento',
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.serviceOrder.create).not.toHaveBeenCalled();
  });

  it('does not start a job unless the customer approved a quote', async () => {
    const tx = {
      orderAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'assignment-1' }) },
      quote: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceOrder: { updateMany: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (value: any) => unknown) => callback(tx));

    await expect(service.startOrder('provider-1', 'order-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.serviceOrder.updateMany).not.toHaveBeenCalled();
  });

  it('does not expose dispatches to a provider who is not approved', async () => {
    prisma.providerProfile = {
      findFirst: jest.fn().mockResolvedValue(null),
    };

    await expect(service.listProviderDispatches('provider-pending')).rejects.toBeInstanceOf(Error);
    expect(prisma.providerProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ approvalStatus: 'approved' }),
    }));
  });
});
