import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConversationsClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('CONVERSATIONS_SERVICE_URL') ?? 'http://localhost:3003';
  }

  async esParticipante(conversationId: string, userId: string): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/internal/conversations/${conversationId}/participants/${userId}`,
        { signal: AbortSignal.timeout(2000) },
      );
    } catch {
      throw new ServiceUnavailableException('conversations-service no disponible');
    }

    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      throw new BadGatewayException(
        'Respuesta inesperada de conversations-service',
      );
    }

    const data: { participa?: unknown } = await response.json();
    if (typeof data.participa !== 'boolean') {
      throw new BadGatewayException(
        'Respuesta inválida de conversations-service',
      );
    }
    return data.participa;
  }
}
