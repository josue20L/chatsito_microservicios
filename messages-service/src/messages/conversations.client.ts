import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConversationsClient {
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('CONVERSATIONS_SERVICE_URL') || '';
  }

  async esParticipante(idConversacion: string, idUsuario: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/internal/conversations/${idConversacion}/participants/${idUsuario}`,
        { signal: AbortSignal.timeout(2000) },
      );
      if (!response.ok) {
        throw new BadGatewayException('conversations-service respondió con estado inesperado');
      }

      const data = await response.json();
      return data.participa === true;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new ServiceUnavailableException('conversations-service no disponible');
    }
  }
}
