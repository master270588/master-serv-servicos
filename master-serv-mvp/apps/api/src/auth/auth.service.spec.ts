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


describe('AuthService provider review', () => {
  let service: AuthService;
  let tx: any;
  let prisma: PrismaService;

  const profile = {
    userId: 'provider-1',
    displayName: 'Profissional Teste',
    approvalStatus: 'pending',
  };

  beforeEach(() => {
    tx = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn().mockImplementation(async ({ data, select }) => ({
          userId: profile.userId,
          displayName: profile.displayName,
          approvalStatus: data.approvalStatus,
        })),
      },
      appUser: { update: jest.fn().mockResolvedValue({}) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    service = new AuthService(
      prisma,
      { signAsync: jest.fn() } as unknown as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
    );
  });

  it('approves the provider, activates the account and records the audit event', async () => {
    await expect(service.reviewProvider('provider-1', 'approved', 'admin-1')).resolves.toEqual({
      userId: 'provider-1',
      displayName: 'Profissional Teste',
      approvalStatus: 'approved',
      accountStatus: 'active',
    });

    expect(tx.providerProfile.update).toHaveBeenCalledWith({
      where: { userId: 'provider-1' },
      data: { approvalStatus: 'approved' },
      select: { userId: true, displayName: true, approvalStatus: true },
    });
    expect(tx.appUser.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: { status: 'active' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-1',
        action: 'provider.approved',
        entityType: 'provider_profile',
        entityId: 'provider-1',
        metadata: { previousApprovalStatus: 'pending', newApprovalStatus: 'approved' },
      },
    });
  });

  it('rejects the provider, blocks the account and records the decision', async () => {
    await expect(service.reviewProvider('provider-1', 'rejected', 'admin-1')).resolves.toMatchObject({
      approvalStatus: 'rejected',
      accountStatus: 'blocked',
    });

    expect(tx.appUser.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: { status: 'blocked' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'provider.rejected',
        entityType: 'provider_profile',
        entityId: 'provider-1',
      }),
    });
  });

  it('does not change a blocked provider or create an audit event', async () => {
    tx.providerProfile.findUnique.mockResolvedValue({
      ...profile,
      approvalStatus: 'blocked',
    });

    await expect(
      service.reviewProvider('provider-1', 'approved', 'admin-1'),
    ).rejects.toThrow('Prestador bloqueado não pode ser aprovado por este fluxo.');

    expect(tx.providerProfile.update).not.toHaveBeenCalled();
    expect(tx.appUser.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('returns an error when the provider profile does not exist', async () => {
    tx.providerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.reviewProvider('missing-provider', 'approved', 'admin-1'),
    ).rejects.toThrow('Prestador não encontrado.');

    expect(tx.providerProfile.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
