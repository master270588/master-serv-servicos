import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      application: 'MASTER SERV SERVIÇOS API',
      timestamp: new Date().toISOString(),
      message: 'API inicial em funcionamento',
    };
  }
}
