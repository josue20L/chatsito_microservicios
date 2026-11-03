import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ForwardAudioDto } from './dto/forward-audio.dto.js';
import { ConversationsClient } from './conversations.client.js';
import { MessagesClient } from './messages.client.js';
import type {
  Archivo,
  AudioMessageResponse,
} from './interfaces/archivo.interface.js';

type StoredAudio = {
  id_archivo: bigint;
  id_mensaje: bigint | null;
  id_conversacion: bigint;
  id_remitente: bigint;
  nombre: string;
  formato: string;
  tamano_bytes: bigint;
  duracion_segundos: number | null;
  object_key: string;
  reenviado_de_id: bigint | null;
  fecha_subida: Date;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly storageDir: string;
  private readonly notificationsUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsClient: ConversationsClient,
    private readonly messagesClient: MessagesClient,
    config: ConfigService,
  ) {
    const configuredDir = config.get<string>('MEDIA_STORAGE_DIR') ?? './uploads';
    this.storageDir = isAbsolute(configuredDir)
      ? configuredDir
      : resolve(process.cwd(), configuredDir);
    this.notificationsUrl =
      config.get<string>('NOTIFICATIONS_SERVICE_URL') ?? 'http://localhost:3006';
  }

  async uploadAudio(
    conversationId: string,
    file: Express.Multer.File,
    durationSeconds: number | null,
    user: CurrentUser,
  ): Promise<AudioMessageResponse> {
    await this.requireParticipation(conversationId, user.id_usuario);

    const extension = extname(file.originalname).toLowerCase();
    const objectKey = `${randomUUID()}${extension}`;
    const safeName = this.safeFilename(file.originalname, extension);
    await this.saveBuffer(objectKey, file.buffer);

    let record: StoredAudio;
    try {
      record = await this.prisma.media_archivos.create({
        data: {
          id_conversacion: BigInt(conversationId),
          id_remitente: BigInt(user.id_usuario),
          nombre: safeName,
          formato: file.mimetype,
          tamano_bytes: BigInt(file.size),
          duracion_segundos: durationSeconds,
          object_key: objectKey,
        },
      });
    } catch (error) {
      await this.removeFileAfterFailure(objectKey);
      throw error;
    }

    return this.createMessageAndAttach(record, user.id_usuario);
  }

  async getAudio(
    messageId: string,
    user: CurrentUser,
  ): Promise<{
    stream: ReadStream;
    nombre: string;
    formato: string;
    tamano_bytes: number;
  }> {
    const message = await this.messagesClient.obtenerMensaje(messageId);
    if (!message || message.tipo !== 'audio' || message.eliminado_en) {
      throw new NotFoundException('Audio no encontrado');
    }

    await this.requireParticipation(message.id_conversacion, user.id_usuario);
    const record = await this.prisma.media_archivos.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });
    if (!record || record.id_conversacion.toString() !== message.id_conversacion) {
      throw new NotFoundException('Audio no encontrado');
    }

    const filePath = this.objectPath(record.object_key);
    try {
      await stat(filePath);
    } catch (error) {
      if (this.isMissingFile(error)) {
        throw new NotFoundException('Archivo de audio no encontrado');
      }
      throw error;
    }

    return {
      stream: createReadStream(filePath),
      nombre: record.nombre,
      formato: record.formato,
      tamano_bytes: Number(record.tamano_bytes),
    };
  }

  async forwardAudio(
    messageId: string,
    dto: ForwardAudioDto,
    user: CurrentUser,
  ): Promise<AudioMessageResponse> {
    const originalMessage = await this.messagesClient.obtenerMensaje(messageId);
    if (
      !originalMessage ||
      originalMessage.tipo !== 'audio' ||
      originalMessage.eliminado_en
    ) {
      throw new NotFoundException('Audio original no encontrado');
    }

    await this.requireParticipation(
      originalMessage.id_conversacion,
      user.id_usuario,
    );
    await this.requireParticipation(dto.id_conversacion, user.id_usuario);

    const originalAudio = await this.prisma.media_archivos.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });
    if (!originalAudio) {
      throw new NotFoundException('Archivo de audio original no encontrado');
    }

    const extension = extname(originalAudio.nombre).toLowerCase();
    const objectKey = `${randomUUID()}${extension}`;
    await mkdir(this.storageDir, { recursive: true });
    await copyFile(this.objectPath(originalAudio.object_key), this.objectPath(objectKey));

    let forwardedAudio: StoredAudio;
    try {
      forwardedAudio = await this.prisma.media_archivos.create({
        data: {
          id_conversacion: BigInt(dto.id_conversacion),
          id_remitente: BigInt(user.id_usuario),
          nombre: originalAudio.nombre,
          formato: originalAudio.formato,
          tamano_bytes: originalAudio.tamano_bytes,
          duracion_segundos: originalAudio.duracion_segundos,
          object_key: objectKey,
          reenviado_de_id: BigInt(messageId),
        },
      });
    } catch (error) {
      await this.removeFileAfterFailure(objectKey);
      throw error;
    }

    return this.createMessageAndAttach(
      forwardedAudio,
      user.id_usuario,
      messageId,
    );
  }

  async getArchives(messageIds: string[]): Promise<Record<string, Archivo>> {
    if (messageIds.length === 0) {
      return {};
    }
    const ids = [...new Set(messageIds)];
    if (ids.some((id) => !/^\d+$/.test(id))) {
      throw new BadRequestException('ids debe contener números');
    }

    const records = await this.prisma.media_archivos.findMany({
      where: { id_mensaje: { in: ids.map((id) => BigInt(id)) } },
    });
    return Object.fromEntries(
      records
        .filter((record) => record.id_mensaje !== null)
        .map((record) => [
          record.id_mensaje!.toString(),
          this.toArchivo(record),
        ]),
    );
  }

  async deleteArchive(messageId: string): Promise<void> {
    const record = await this.prisma.media_archivos.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });
    if (!record) {
      return;
    }

    await this.prisma.media_archivos.delete({
      where: { id_archivo: record.id_archivo },
    });
    await this.removeFileAfterFailure(record.object_key);
  }

  private async createMessageAndAttach(
    record: StoredAudio,
    senderId: string,
    forwardedFromId?: string,
  ): Promise<AudioMessageResponse> {
    let messageId: string | undefined;
    try {
      const message = await this.messagesClient.crearMensajeAudio({
        id_conversacion: record.id_conversacion.toString(),
        id_remitente: senderId,
        reenviado_de_id: forwardedFromId,
        archivo: this.toArchivo(record),
      });
      if (!/^\d+$/.test(message.id_mensaje)) {
        throw new BadGatewayException('messages-service devolvió un id inválido');
      }
      messageId = message.id_mensaje;
      await this.prisma.media_archivos.update({
        where: { id_archivo: record.id_archivo },
        data: { id_mensaje: BigInt(messageId) },
      });

      const response = {
        ...message,
        reenviado_de_id: forwardedFromId ?? null,
        archivo: this.toArchivo(record),
      };
      await this.notifyMessageChanged(record.id_conversacion.toString());
      return response;
    } catch (error) {
      await this.rollbackCreatedAudio(record, messageId);
      throw error;
    }
  }

  private async requireParticipation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const participates = await this.conversationsClient.esParticipante(
      conversationId,
      userId,
    );
    if (!participates) {
      throw new ForbiddenException(
        'No eres participante de esta conversación',
      );
    }
  }

  private toArchivo(record: StoredAudio): Archivo {
    return {
      id_archivo: record.id_archivo.toString(),
      nombre: record.nombre,
      formato: record.formato,
      tamano_bytes: Number(record.tamano_bytes),
      duracion_segundos: record.duracion_segundos,
    };
  }

  private safeFilename(originalName: string, extension: string): string {
    const name = basename(originalName)
      .replace(/[\\/]/g, '_')
      .replace(/[\u0000-\u001f"]/g, '_')
      .slice(0, 255);
    if (!name || name === extension) {
      return `audio${extension}`;
    }
    return name;
  }

  private async saveBuffer(objectKey: string, buffer: Buffer): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
    await writeFile(this.objectPath(objectKey), buffer, { flag: 'wx' });
  }

  private objectPath(objectKey: string): string {
    const filePath = resolve(this.storageDir, objectKey);
    const fromStorage = relative(this.storageDir, filePath);
    if (fromStorage.startsWith(`..${sep}`) || fromStorage === '..') {
      throw new BadRequestException('Referencia de archivo inválida');
    }
    return filePath;
  }

  private async rollbackCreatedAudio(
    record: StoredAudio,
    messageId?: string,
  ): Promise<void> {
    if (messageId) {
      try {
        await this.messagesClient.eliminarMensaje(messageId);
      } catch (error) {
        this.logger.error(
          `No se pudo revertir el mensaje ${messageId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    try {
      await this.prisma.media_archivos.delete({
        where: { id_archivo: record.id_archivo },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo revertir el registro de archivo ${record.id_archivo}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.removeFileAfterFailure(record.object_key);
  }

  private async removeFileAfterFailure(objectKey: string): Promise<void> {
    try {
      await unlink(this.objectPath(objectKey));
    } catch (error) {
      if (this.isMissingFile(error)) {
        return;
      }
      this.logger.error(
        `No se pudo eliminar el archivo ${objectKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private isMissingFile(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    );
  }

  private async notifyMessageChanged(conversationId: string): Promise<void> {
    try {
      const response = await fetch(`${this.notificationsUrl}/internal/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, kind: 'message' }),
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        this.logger.warn(
          `notifications-service respondió ${response.status}; audio guardado sin notificación`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo notificar el mensaje de audio: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
