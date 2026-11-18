import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLES_KEY } from './roles.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.sub) throw new ForbiddenException('Usuário não autenticado.');
    const assignments = await this.prisma.userRole.findMany({
      where: { userId: request.user.sub },
      select: { role: { select: { code: true } } },
    });
    {
      const currentRoles = assignments.map((item) => item.role.code);
      const allowed = required.some((role) => currentRoles.includes(role));
      if (!allowed) throw new ForbiddenException('Você não tem permissão para esta operação.');
      request.user.roles = currentRoles;
      return true;
    });
  }
}
