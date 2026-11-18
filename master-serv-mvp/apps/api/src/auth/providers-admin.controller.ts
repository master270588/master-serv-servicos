import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from './guards/jwt-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './guards/roles.decorator';
import { AuthService } from './auth.service';

@Controller('admin/providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class ProvidersAdminController {
  constructor(private readonly auth: AuthService) {}

  @Get('pending')
  listPending() {
    return this.auth.listPendingProviders();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.reviewProvider(id, 'approved', request.user.sub);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.auth.reviewProvider(id, 'rejected', request.user.sub);
  }
}
