import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MessagesService } from './messages.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: any,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.createMessage(id, dto, user);
  }

  @Get(':id/messages')
  async getMessages(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('antes_de') antesDe?: string,
    @Query('despues_de') despuesDe?: string,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    if (antesDe && !/^\d+$/.test(antesDe)) {
      throw new BadRequestException('antes_de debe ser un número');
    }
    if (despuesDe && !/^\d+$/.test(despuesDe)) {
      throw new BadRequestException('despues_de debe ser un número');
    }
    return this.messagesService.getMessages(id, user, limit, antesDe, despuesDe);
  }

  @Post(':id/messages/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.markAsRead(id, user);
  }
}
