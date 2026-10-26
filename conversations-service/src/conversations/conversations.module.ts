import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.js';
import { InternalConversationsController } from './internal-conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { UsersClient } from './users.client.js';

@Module({
  controllers: [ConversationsController, InternalConversationsController],
  providers: [ConversationsService, UsersClient],
})
export class ConversationsModule {}
