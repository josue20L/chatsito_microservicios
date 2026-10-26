import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Este servicio no tiene base de datos, solo confirma que está vivo
  @Get()
  check() {
    return { status: 'ok' };
  }
}