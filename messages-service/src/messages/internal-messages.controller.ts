import { Controller, Get, Post, Delete, Param, Body, Query, BadRequestException, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessageResponse } from './interfaces/message-response.interface.js';

// Rutas internas: no se exponen por el gateway
@Controller('internal/messages')
export class InternalMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('unread-counts')
  async getUnreadCounts(
    @Query('userId') userId: string,
    @Query('conversationIds') conversationIds: string,
  ): Promise<Record<string, number>> {
    if (!userId || !conversationIds) {
      throw new BadRequestException('userId y conversationIds son requeridos');
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      throw new BadRequestException('userId debe ser un entero positivo');
    }

    const ids = conversationIds.split(',');
    const result: Record<string, number> = {};

    for (const id of ids) {
      const idNum = parseInt(id, 10);
      if (isNaN(idNum) || idNum <= 0) {
        throw new BadRequestException('conversationIds debe contener enteros positivos');
      }
      result[id] = await this.messagesService.getUnreadCount(id, userId);
    }

    return result;
  }

  @Post('audio')
  async createAudioMessage(
    @Body() body: { id_conversacion: string; id_remitente: string; reenviado_de_id?: string },
  ): Promise<MessageResponse> {
    return this.messagesService.createAudioMessage(body);
  }

  @Get(':id')
  async getMessageById(@Param('id') id: string): Promise<{ id_mensaje: string; id_conversacion: string; id_remitente: string; tipo: string; eliminado_en: Date | null }> {
    return this.messagesService.getMessageBasicInfo(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(@Param('id') id: string): Promise<void> {
    await this.messagesService.deleteMessageInternal(id);
  }
}
