import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { MediaService } from './media.service.js';

@Controller('internal/media')
export class InternalMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('messages')
  async getMessageArchives(@Query('ids') ids = '') {
    if (!ids) {
      return {};
    }
    const messageIds = ids.split(',');
    if (messageIds.some((id) => !/^\d+$/.test(id))) {
      throw new BadRequestException('ids debe contener números');
    }
    return this.mediaService.getArchives(messageIds);
  }

  @Delete('messages/:id')
  async deleteMessageArchive(@Param('id') id: string) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('id debe ser un número');
    }
    await this.mediaService.deleteArchive(id);
    return { deleted: true };
  }
}
