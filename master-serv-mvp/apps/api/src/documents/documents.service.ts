import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnDocuments(providerUserId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Perfil de prestador não encontrado.');

    return this.prisma.providerDocument.findMany({
      where: { providerUserId },
      select: {
        id: true,
        documentType: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        reviewStatus: true,
        expiresAt: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listProviderDocuments(providerUserId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId: providerUserId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('Perfil de prestador não encontrado.');

    return this.prisma.providerDocument.findMany({
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
        select: { id: true, providerUserId: true, reviewStatus: true },
      });
      if (!document) throw new NotFoundException('Documento não encontrado.');
      if (document.reviewStatus !== 'pending') {
        throw new ConflictException('Somente documentos pendentes podem ser analisados.');
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
