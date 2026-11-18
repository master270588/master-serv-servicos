import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: { sub: string; roles: string[] };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Autenticação necessária.');
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret || secret.length < 32) throw new UnauthorizedException('Autenticação indisponível.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; roles?: string[] }>(token, {
        secret,
        issuer: 'master-serv-api',
        audience: 'master-serv-app',
      });
      if (!payload.sub || !Array.isArray(payload.roles)) throw new Error('Invalid token claims');
      request.user = { sub: payload.sub, roles: payload.roles };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
