import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: confirma apenas que o processo HTTP está respondendo.
  @Get()
  check() {
    return {
      status: 'ok',
      application: 'MASTER SERV SERVIÇOS API',
      timestamp: new Date().toISOString(),
      message: 'API em funcionamento',
    };
  }

  // Readiness: só considera a API pronta quando o banco responde.
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        application: 'MASTER SERV SERVIÇOS API',
        dependencies: { database: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        application: 'MASTER SERV SERVIÇOS API',
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
