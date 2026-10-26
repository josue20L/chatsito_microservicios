import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreatePrivateDto } from './dto/create-private.dto.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { AddParticipantDto } from './dto/add-participant.dto.js';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post('private')
  async createPrivate(@Body() dto: CreatePrivateDto, @CurrentUser() currentUser: CurrentUser) {
    return this.conversationsService.createPrivate(dto, currentUser);
  }

  @Post('group')
  async createGroup(@Body() dto: CreateGroupDto, @CurrentUser() currentUser: CurrentUser) {
    return this.conversationsService.createGroup(dto, currentUser);
  }

  @Get()
  async findAll(@CurrentUser() currentUser: CurrentUser) {
    return this.conversationsService.findAll(currentUser);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: CurrentUser) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.conversationsService.findOne(id, currentUser);
  }

  @Post(':id/participants')
  async addParticipant(
    @Param('id') id: string,
    @Body() dto: AddParticipantDto,
    @CurrentUser() currentUser: CurrentUser,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.conversationsService.addParticipant(id, dto, currentUser);
  }
}
