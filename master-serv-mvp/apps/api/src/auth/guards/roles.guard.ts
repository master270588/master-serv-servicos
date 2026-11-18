import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLES_KEY } from './roles.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed = required.some((role) => request.user?.roles?.includes(role));
    if (!allowed) throw new ForbiddenException('Você não tem permissão para esta operação.');
    return true;
  }
}
