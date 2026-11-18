import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Observable,
  PayloadTooLargeException,
  Controller,
  StreamableFile,
  Res,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { DocumentsService } from './documents.service';
import { ReviewDocumentDto } from './dto/review-document.dto';
import type { Response } from 'express';

const MulterDocumentInterceptor = FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new BadRequestException('Formato não permitido. Envie PDF, JPEG ou PNG.'), false);
    }
    callback(null, true);
  },
});

@Injectable()
class ProviderDocumentUploadInterceptor implements NestInterceptor {
  private readonly delegate = new MulterDocumentInterceptor();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.delegate.intercept(context, next);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;

      if (code === 'LIMIT_FILE_SIZE') {
        throw new PayloadTooLargeException('O arquivo excede o limite de 10 MiB.');
      }
      if (typeof code === 'string' && code.startsWith('LIMIT_')) {
        throw new BadRequestException('O envio contém campos ou arquivos acima dos limites permitidos.');
      }
      throw error;
    }
  }
}

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('providers/me/documents')
  @UseGuards(RolesGuard)
  @Roles('provider')
  @UseInterceptors(ProviderDocumentUploadInterceptor)
  uploadOwn(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body('documentType') documentType: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.uploadOwnDocument(request.user.sub, file, documentType);
  }

  @Get('providers/me/documents/:documentId/file')
  @UseGuards(RolesGuard)
  @Roles('provider')
  async downloadOwn(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.documents.downloadOwnDocument(request.user.sub, documentId);
    const safeFilename = document.filename.replace(/[\\"\r\n]/g, '_');
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(document.stream);
  }

  @Get('providers/me/documents')
  listOwn(@Req() request: AuthenticatedRequest) {
    return this.documents.listOwnDocuments(request.user.sub);
  }

  @Get('admin/providers/:providerId/documents')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  listProvider(
    @Param('providerId', new ParseUUIDPipe()) providerId: string,
  ) {
    return this.documents.listProviderDocuments(providerId);
  }

  @Get('admin/provider-documents/:documentId/file')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async downloadForReview(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.documents.downloadDocumentForAdmin(documentId);
    const safeFilename = document.filename.replace(/[\\"\r\n]/g, '_');
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(document.stream);
  }

  @Patch('admin/provider-documents/:documentId/review')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  review(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() dto: ReviewDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.reviewDocument(
      documentId,
      request.user.sub,
      dto.decision,
      dto.reason,
    );
  }
}
