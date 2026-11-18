import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const createController = () => {
    const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
    return { controller: new HealthController(prisma), prisma };
  };

  it('reports liveness without depending on the database', () => {
    const { controller } = createController();
    expect(controller.check()).toMatchObject({
      status: 'ok',
      application: 'MASTER SERV SERVIÇOS API',
    });
  });

  it('reports readiness when PostgreSQL responds', async () => {
    const { controller, prisma } = createController();
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ready',
      dependencies: { database: 'ok' },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 503 readiness when PostgreSQL is unavailable', async () => {
    const { controller, prisma } = createController();
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('database offline'));

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
