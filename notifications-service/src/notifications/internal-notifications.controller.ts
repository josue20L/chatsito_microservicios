import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { NotifyDto } from './dto/notify.dto.js';
import { RealtimeGateway } from './realtime.gateway.js';

// Rutas internas: no se exponen por el gateway
@Controller('internal/notify')
export class InternalNotificationsController {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  @Post()
  @HttpCode(202)
  async notify(@Body() dto: NotifyDto) {
    await this.realtimeGateway.changed(dto.conversationId, dto.kind);
    return { ok: true };
  }
}
