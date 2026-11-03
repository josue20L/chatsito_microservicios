import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import {
  CurrentUser,
  type CurrentUser as AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { MediaService } from './media.service.js';
import { ForwardAudioDto } from './dto/forward-audio.dto.js';
import { UploadAudioDto } from './dto/upload-audio.dto.js';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'application/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'video/webm',
]);

@Controller()
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('conversations/:id/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES },
      fileFilter: (_request, file, callback) => {
        const extension = file.originalname
          .slice(file.originalname.lastIndexOf('.'))
          .toLowerCase();
        if (
          !ALLOWED_EXTENSIONS.has(extension) ||
          !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())
        ) {
          callback(new BadRequestException('Formato de audio no permitido'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAudio(
    @Param('id') conversationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [],
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadAudioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!/^\d+$/.test(conversationId)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.mediaService.uploadAudio(
      conversationId,
      file,
      dto.duracion_segundos ?? null,
      user,
    );
  }

  @Get('media/messages/:id')
  async downloadAudio(
    @Param('id') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!/^\d+$/.test(messageId)) {
      throw new BadRequestException('id debe ser un número');
    }
    const audio = await this.mediaService.getAudio(messageId, user);
    response.set({
      'Content-Type': audio.formato,
      'Content-Length': String(audio.tamano_bytes),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(audio.nombre)}`,
    });
    return new StreamableFile(audio.stream);
  }

  @Post('media/messages/:id/forward')
  async forwardAudio(
    @Param('id') messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ForwardAudioDto,
  ) {
    if (!/^\d+$/.test(messageId)) {
      throw new BadRequestException('id debe ser un número');
    }
    return this.mediaService.forwardAudio(messageId, dto, user);
  }
}
