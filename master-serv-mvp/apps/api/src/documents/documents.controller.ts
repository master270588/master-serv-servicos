import {
  Controller,
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

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('providers/me/documents')
  @UseGuards(RolesGuard)
  @Roles('provider')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadOwn(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body('documentType') documentType: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.uploadOwnDocument(request.user.sub, file, documentType);
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
