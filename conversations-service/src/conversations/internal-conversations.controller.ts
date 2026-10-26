import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';

// Rutas internas: no se exponen por el gateway
@Controller('internal/conversations')
export class InternalConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(':id/participants/:userId')
  async participa(@Param('id') id: string, @Param('userId') userId: string) {
    if (!/^\d+$/.test(id) || !/^\d+$/.test(userId)) {
      throw new BadRequestException('Los ids deben ser números');
    }
    const participa = await this.conversationsService.esParticipante(id, userId);
    return { participa };
  }
}
