import { ConflictException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentsService', () => {
  const prisma = {
    providerProfile: { findUnique: jest.fn() },
    providerDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const storage = { storeInQuarantine: jest.fn(), deleteFromQuarantine: jest.fn(), getFromQuarantine: jest.fn() };
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(prisma as unknown as PrismaService, storage as any);
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

  it('stores an uploaded document in quarantine and records pending scan metadata', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ userId: 'provider-1' });
    storage.storeInQuarantine.mockResolvedValue({ storageKey: 'quarantine/providers/provider-1/random', sizeBytes: 8 });
    prisma.providerDocument.create.mockResolvedValue({
      id: 'doc-1', documentType: 'identity', originalFilename: 'id.pdf', mimeType: 'application/pdf',
      sizeBytes: BigInt(8), reviewStatus: 'pending', scanStatus: 'pending', createdAt: new Date(),
    });
    const result = await service.uploadOwnDocument('provider-1', {
      buffer: Buffer.from('%PDF-123'), mimetype: 'application/pdf', originalname: 'id.pdf',
    } as { buffer: Buffer; mimetype: string; originalname: string }, 'identity');
    expect(storage.storeInQuarantine).toHaveBeenCalledWith(expect.objectContaining({ providerUserId: 'provider-1' }));
    expect(prisma.providerDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ storageKey: 'quarantine/providers/provider-1/random', scanStatus: 'pending', reviewStatus: 'pending' }),
    }));
    expect(result.sizeBytes).toBe('8');
  });

  it('removes the quarantined object if database metadata persistence fails', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ userId: 'provider-1' });
    storage.storeInQuarantine.mockResolvedValue({
      storageKey: 'quarantine/providers/provider-1/orphan',
      sizeBytes: 8,
    });
    prisma.providerDocument.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.uploadOwnDocument('provider-1', {
      buffer: Buffer.from('%PDF-123'),
      mimetype: 'application/pdf',
      originalname: 'id.pdf',
    }, 'identity')).rejects.toThrow('database unavailable');

    expect(storage.deleteFromQuarantine).toHaveBeenCalledWith(
      'quarantine/providers/provider-1/orphan',
    );
  });

  it('allows download only for the owning provider after clean scan and approval', async () => {
    const stream = { pipe: jest.fn() };
    prisma.providerDocument.findFirst.mockResolvedValue({
      storageKey: 'quarantine/providers/provider-1/document-1',
      originalFilename: 'comprovante.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'clean',
      reviewStatus: 'approved',
    });
    storage.getFromQuarantine.mockResolvedValue(stream);

    const result = await service.downloadOwnDocument('provider-1', 'document-1');

    expect(prisma.providerDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'document-1', providerUserId: 'provider-1' },
    }));
    expect(storage.getFromQuarantine).toHaveBeenCalledWith(
      'quarantine/providers/provider-1/document-1',
    );
    expect(result).toEqual({
      stream,
      mimeType: 'application/pdf',
      filename: 'comprovante.pdf',
    });
  });

  it('blocks document download until antivirus scan and administrative approval are complete', async () => {
    prisma.providerDocument.findFirst.mockResolvedValue({
      storageKey: 'quarantine/providers/provider-1/document-1',
      originalFilename: 'comprovante.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'pending',
      reviewStatus: 'pending',
    });

    await expect(
      service.downloadOwnDocument('provider-1', 'document-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.getFromQuarantine).not.toHaveBeenCalled();
  });

  it('allows an administrator to inspect a clean document before reviewing it', async () => {
    const stream = { pipe: jest.fn() };
    prisma.providerDocument.findUnique.mockResolvedValue({
      storageKey: 'quarantine/providers/provider-1/document-2',
      originalFilename: 'certificado.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'clean',
    });
    storage.getFromQuarantine.mockResolvedValue(stream);

    const result = await service.downloadDocumentForAdmin('document-2');

    expect(storage.getFromQuarantine).toHaveBeenCalledWith(
      'quarantine/providers/provider-1/document-2',
    );
    expect(result).toEqual({
      stream,
      mimeType: 'application/pdf',
      filename: 'certificado.pdf',
    });
  });

  it('blocks administrator inspection when antivirus scan is not clean', async () => {
    prisma.providerDocument.findUnique.mockResolvedValue({
      storageKey: 'quarantine/providers/provider-1/document-2',
      originalFilename: 'certificado.pdf',
      mimeType: 'application/pdf',
      scanStatus: 'pending',
    });

    await expect(
      service.downloadDocumentForAdmin('document-2'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(storage.getFromQuarantine).not.toHaveBeenCalled();
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
          scanStatus: 'pending',
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
