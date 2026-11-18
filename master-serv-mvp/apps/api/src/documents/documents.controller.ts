import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
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
