import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('USERS_SERVICE_URL') ?? 'http://localhost:3001';
  }

  // Pide a users-service los usuarios que existan. Devuelve un mapa id -> nombre.
  // Los ids que no existan simplemente no aparecen en el mapa.
  async obtenerNombres(ids: string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids)];
    const nombres = new Map<string, string>();
    if (unicos.length === 0) return nombres;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/internal/users?ids=${unicos.join(',')}`);
    } catch {
      throw new ServiceUnavailableException('users-service no disponible');
    }
    if (res.status !== 200) {
      throw new BadGatewayException('Respuesta inesperada de users-service');
    }

    const usuarios = (await res.json()) as { id_usuario: string; nombre: string }[];
    for (const u of usuarios) nombres.set(String(u.id_usuario), u.nombre);
    return nombres;
  }
}
