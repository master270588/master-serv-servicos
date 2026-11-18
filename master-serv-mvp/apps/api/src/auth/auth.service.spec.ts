import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService refresh rotation', () => {
  const token = 'valid-refresh-token';
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = {
    id: 'session-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: 'user-1',
      status: 'active',
      roles: [{ role: { code: 'customer' } }],
    },
  };

  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;
  let service: AuthService;
  let tx: any;

  beforeEach(() => {
    tx = {
      appUser: { findUnique: jest.fn() },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      authSession: { findUnique: jest.fn().mockResolvedValue(session) },
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    jwt = { signAsync: jest.fn().mockResolvedValue('new-access-token') } as unknown as JwtService;
    config = { get: jest.fn().mockReturnValue('a'.repeat(40)) } as unknown as ConfigService;
    service = new AuthService(prisma, jwt, config);
  });

  it('rotates the session using current active account roles', async () => {
    tx.appUser.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      roles: [{ role: { code: 'provider' } }],
    });

    const result = await service.refresh(token);

    expect(tx.appUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        status: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', roles: ['provider'] });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });
    expect(result).toMatchObject({ accessToken: 'new-access-token', tokenType: 'Bearer', expiresIn: 900 });
  });

  it('does not consume the current session when the account is no longer active', async () => {
    tx.appUser.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'blocked',
      roles: [],
    });

    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
    expect(tx.authSession.create).not.toHaveBeenCalled();
  });

  it('rejects reuse when another request already consumed the refresh token', async () => {
    tx.appUser.findUnique.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      roles: [{ role: { code: 'customer' } }],
    });
    tx.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.authSession.create).not.toHaveBeenCalled();
  });
});
