import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Archivo } from './interfaces/message-response.interface.js';

@Injectable()
export class MediaClient {
  private readonly baseUrl: string;
  private readonly logger = new Logger(MediaClient.name);

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('MEDIA_SERVICE_URL') ?? 'http://localhost:3005';
  }

  async obtenerArchivos(messageIds: string[]): Promise<Map<string, Archivo>> {
    const archivos = new Map<string, Archivo>();
    if (messageIds.length === 0) {
      return archivos;
    }

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/internal/media/messages?ids=${messageIds.join(',')}`,
        { signal: AbortSignal.timeout(1500) },
      );
    } catch (error) {
      this.logger.warn(
        `media-service no disponible; mensajes de audio sin metadatos: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return archivos;
    }

    if (!response.ok) {
      this.logger.warn(
        `media-service respondió ${response.status}; mensajes de audio sin metadatos`,
      );
      return archivos;
    }

    let data: Record<string, Archivo>;
    try {
      data = (await response.json()) as Record<string, Archivo>;
    } catch (error) {
      this.logger.warn(
        `Respuesta inválida de media-service: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return archivos;
    }

    for (const [messageId, archivo] of Object.entries(data)) {
      if (
        archivo &&
        typeof archivo.id_archivo === 'string' &&
        typeof archivo.nombre === 'string' &&
        typeof archivo.formato === 'string' &&
        typeof archivo.tamano_bytes === 'number'
      ) {
        archivos.set(messageId, archivo);
      }
    }
    return archivos;
  }
}
