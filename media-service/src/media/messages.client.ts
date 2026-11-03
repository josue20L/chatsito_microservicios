import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AudioMessageResponse,
  InternalMessageInfo,
} from './interfaces/archivo.interface.js';

export interface CreateAudioMessage {
  id_conversacion: string;
  id_remitente: string;
  reenviado_de_id?: string;
  archivo: {
    id_archivo: string;
    nombre: string;
    formato: string;
    tamano_bytes: number;
    duracion_segundos: number | null;
  };
}

@Injectable()
export class MessagesClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('MESSAGES_SERVICE_URL') ?? 'http://localhost:3004';
  }

  async crearMensajeAudio(
    body: CreateAudioMessage,
  ): Promise<AudioMessageResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/internal/messages/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new ServiceUnavailableException('messages-service no disponible');
    }
    if (response.status !== 201 && response.status !== 200) {
      throw new BadGatewayException(
        'Respuesta inesperada de messages-service',
      );
    }
    return (await response.json()) as AudioMessageResponse;
  }

  async obtenerMensaje(id: string): Promise<InternalMessageInfo | null> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/internal/messages/${id}`, {
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      throw new ServiceUnavailableException('messages-service no disponible');
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Respuesta inesperada de messages-service',
      );
    }
    return (await response.json()) as InternalMessageInfo;
  }

  async eliminarMensaje(id: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/internal/messages/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      throw new ServiceUnavailableException('messages-service no disponible');
    }
    if (!response.ok && response.status !== 404) {
      throw new BadGatewayException(
        'No se pudo revertir el mensaje en messages-service',
      );
    }
  }
}
