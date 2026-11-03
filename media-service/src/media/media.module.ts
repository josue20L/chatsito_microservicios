import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { InternalMediaController } from './internal-media.controller.js';
import { MediaService } from './media.service.js';
import { ConversationsClient } from './conversations.client.js';
import { MessagesClient } from './messages.client.js';

@Module({
  controllers: [MediaController, InternalMediaController],
  providers: [MediaService, ConversationsClient, MessagesClient],
})
export class MediaModule {}
