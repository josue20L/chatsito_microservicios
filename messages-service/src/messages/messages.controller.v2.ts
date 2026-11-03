import {
  Controller,
  Delete,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MessagesService } from './messages.service.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';
import { ForwardMessageDto } from './dto/forward-message.dto.js';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesControllerV2 {
  constructor(private readonly messagesService: MessagesService) {}

  @Delete(':id')
  async deleteMessage(@Param('id') id: string, @CurrentUser() user: any) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id inválido');
    }
    return this.messagesService.deleteMessage(id, user);
  }

  @Patch(':id')
  async updateMessage(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: any,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.updateMessage(id, dto, user);
  }

  @Post(':id/forward')
  async forwardMessage(
    @Param('id') id: string,
    @Body() dto: ForwardMessageDto,
    @CurrentUser() user: any,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.messagesService.forwardMessage(id, dto, user);
  }
}
