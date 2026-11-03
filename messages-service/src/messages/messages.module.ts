import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessagesController } from './messages.controller.js';
import { MessagesControllerV2 } from './messages.controller.v2.js';
import { InternalMessagesController } from './internal-messages.controller.js';
import { UsersClient } from './users.client.js';
import { ConversationsClient } from './conversations.client.js';
import { MediaClient } from './media.client.js';

@Module({
  controllers: [MessagesController, MessagesControllerV2, InternalMessagesController],
  providers: [MessagesService, UsersClient, ConversationsClient, MediaClient],
})
export class MessagesModule {}
