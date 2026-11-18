import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2QuarantineStorageService } from '../storage/r2-quarantine-storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2QuarantineStorageService,
  ) {}

  async uploadOwnDocument(providerUserId: string, file: Express.Multer.File, documentType: string) {
    const allowedTypes = ['identity', 'address', 'professional_certificate', 'other'];
    if (!allowedTypes.includes(documentType)) {
      throw new BadRequestException('Tipo de documento inválido.');
    }
    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Envie um arquivo válido.');
    }
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Perfil de prestador não encontrado.');

    const stored = await this.storage.storeInQuarantine({
      providerUserId,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
    const safeFilename = (file.originalname || 'documento')
      .replace(/[\\/\\0-\\x1f\\x7f]/g, '_')
      .slice(0, 180);
    const document = await this.prisma.providerDocument.create({
      data: {
        providerUserId,
        documentType,
        storageKey: stored.storageKey,
        originalFilename: safeFilename || 'documento',
        mimeType: file.mimetype,
        sizeBytes: BigInt(stored.sizeBytes),
        reviewStatus: 'pending',
        scanStatus: 'pending',
      },
      select: { id: true, documentType: true, originalFilename: true, mimeType: true, sizeBytes: true, reviewStatus: true, scanStatus: true, createdAt: true },
    });
    return { ...document, sizeBytes: document.sizeBytes.toString() };
  }

  async listOwnDocuments(providerUserId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Perfil de prestador não encontrado.');

    const documents = await this.prisma.providerDocument.findMany({
      where: { providerUserId },
      select: {
        id: true,
        documentType: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        reviewStatus: true,
        scanStatus: true,
        expiresAt: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => ({
      ...document,
      sizeBytes: document.sizeBytes.toString(),
    }));
  }

  async listProviderDocuments(providerUserId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Perfil de prestador não encontrado.');

    const documents = await this.prisma.providerDocument.findMany({
      where: { providerUserId },
      select: {
        id: true,
        providerUserId: true,
        documentType: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        reviewStatus: true,
        expiresAt: true,
        reviewedBy: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => ({
      ...document,
      sizeBytes: document.sizeBytes.toString(),
    }));
  }

  async reviewDocument(
    documentId: string,
    reviewerUserId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    if (decision === 'rejected' && !reason?.trim()) {
      throw new BadRequestException('Informe o motivo da rejeição.');
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.providerDocument.findUnique({
        where: { id: documentId },
        select: { id: true, providerUserId: true, reviewStatus: true, scanStatus: true },
      });
      if (!document) throw new NotFoundException('Documento não encontrado.');
      if (document.reviewStatus !== 'pending') {
        throw new ConflictException('Somente documentos pendentes podem ser analisados.');
      }

      if (decision === 'approved' && document.scanStatus !== 'clean') {
        throw new ConflictException('O documento precisa passar pela verificação antivírus antes da aprovação.');
      }

      const now = new Date();
      const changed = await tx.providerDocument.updateMany({
        where: { id: documentId, reviewStatus: 'pending' },
        data: {
          reviewStatus: decision,
          reviewedBy: reviewerUserId,
          reviewedAt: now,
          rejectionReason: decision === 'rejected' ? reason!.trim() : null,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException('O documento já foi analisado por outro administrador.');
      }

      await tx.auditEvent.create({
        data: {
          actorUserId: reviewerUserId,
          action: decision === 'approved' ? 'provider_document.approved' : 'provider_document.rejected',
          entityType: 'provider_document',
          entityId: documentId,
          metadata: {
            providerUserId: document.providerUserId,
            decision,
            reason: decision === 'rejected' ? reason!.trim() : null,
          },
        },
      });

      return {
        id: documentId,
        providerUserId: document.providerUserId,
        reviewStatus: decision,
        reviewedAt: now,
      };
    });
  }
}
