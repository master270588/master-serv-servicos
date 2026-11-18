import { ConflictException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentsService', () => {
  const prisma = {
    providerProfile: { findUnique: jest.fn() },
    providerDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(prisma as unknown as PrismaService);
  });

  it('lists only the authenticated provider documents and omits storage keys', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ userId: 'provider-1' });
    prisma.providerDocument.findMany.mockResolvedValue([]);

    await service.listOwnDocuments('provider-1');

    expect(prisma.providerDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerUserId: 'provider-1' },
        select: expect.not.objectContaining({ storageKey: true }),
      }),
    );
  });

  it('requires a reason when rejecting a document', async () => {
    await expect(
      service.reviewDocument('document-1', 'admin-1', 'rejected'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records the administrative decision and audit event atomically', async () => {
    const tx = {
      providerDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'document-1',
          providerUserId: 'provider-1',
          reviewStatus: 'pending',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await service.reviewDocument(
      'document-1',
      'admin-1',
      'rejected',
      'Documento ilegível',
    );

    expect(tx.providerDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-1', reviewStatus: 'pending' },
        data: expect.objectContaining({
          reviewStatus: 'rejected',
          reviewedBy: 'admin-1',
          rejectionReason: 'Documento ilegível',
        }),
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'admin-1',
          action: 'provider_document.rejected',
          entityId: 'document-1',
        }),
      }),
    );
    expect(result.reviewStatus).toBe('rejected');
  });

  it('does not review a document that is no longer pending', async () => {
    const tx = {
      providerDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'document-1',
          providerUserId: 'provider-1',
          reviewStatus: 'approved',
        }),
        updateMany: jest.fn(),
      },
      auditEvent: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    );

    await expect(
      service.reviewDocument('document-1', 'admin-1', 'approved'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.providerDocument.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
