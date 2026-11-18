import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const prisma = { userRole: { findMany: jest.fn() } } as unknown as PrismaService;
  const guard = new RolesGuard(reflector, prisma);

  const makeContext = (user?: { sub: string; roles: string[] }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('permite acesso quando o papel atual no banco está autorizado', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['admin', 'super_admin']);
    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
      { role: { code: 'admin' } },
    ]);
    const requestUser = { sub: 'user-1', roles: ['customer'] };

    await expect(guard.canActivate(makeContext(requestUser))).resolves.toBe(true);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { role: { select: { code: true } } },
    });
    expect(requestUser.roles).toEqual(['admin']);
  });

  it('nega acesso quando o usuário não tem o papel exigido no banco', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);
    (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
      { role: { code: 'customer' } },
    ]);

    await expect(
      guard.canActivate(makeContext({ sub: 'user-2', roles: ['admin'] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nega acesso se não houver usuário autenticado', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['admin']);

    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });

  it('não consulta papéis quando a rota não exige função específica', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });
});
