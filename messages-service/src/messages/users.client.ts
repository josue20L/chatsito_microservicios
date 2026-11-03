import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersClient {
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('USERS_SERVICE_URL') || '';
  }

  async obtenerNombres(ids: string[]): Promise<Map<string, string>> {
    if (!ids || ids.length === 0) {
      return new Map();
    }

    const idsUnicos = [...new Set(ids)];
    const idsStr = idsUnicos.join(',');

    try {
      const response = await fetch(`${this.baseUrl}/internal/users?ids=${idsStr}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) {
        return new Map();
      }

      const users = await response.json();
      const mapa = new Map<string, string>();
      for (const user of users) {
        mapa.set(user.id_usuario, user.nombre);
      }
      return mapa;
    } catch (error) {
      return new Map();
    }
  }
}
