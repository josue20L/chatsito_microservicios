import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagesClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('MESSAGES_SERVICE_URL') ?? 'http://localhost:3004';
  }

  async obtenerNoLeidos(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (conversationIds.length === 0) {
      return counts;
    }

    const query = new URLSearchParams({
      userId,
      conversationIds: conversationIds.join(','),
    });

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/internal/messages/unread-counts?${query}`,
        { signal: AbortSignal.timeout(2000) },
      );
    } catch {
      throw new ServiceUnavailableException('messages-service no disponible');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        'Respuesta inesperada de messages-service al consultar no leídos',
      );
    }

    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      Array.isArray(result)
    ) {
      throw new BadGatewayException(
        'Respuesta inválida de messages-service al consultar no leídos',
      );
    }

    const data = result as Record<string, unknown>;
    for (const id of conversationIds) {
      const count = data[id];
      if (
        typeof count !== 'number' ||
        !Number.isSafeInteger(count) ||
        count < 0
      ) {
        throw new BadGatewayException(
          'messages-service devolvió un conteo no válido',
        );
      }
      counts.set(id, count);
    }

    return counts;
  }
}
