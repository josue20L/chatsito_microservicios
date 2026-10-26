import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UsuarioInterno {
  id_usuario: string;
  nombre: string;
  correo: string;
  password_hash?: string;
  fecha_registro: string;
}

@Injectable()
export class UsersClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('USERS_SERVICE_URL') ?? 'http://localhost:3001';
  }

  // Hace la llamada HTTP; si users-service no responde, lanza 503
  private async llamar(ruta: string, init?: RequestInit) {
    try {
      const res = await fetch(`${this.baseUrl}${ruta}`, init);
      const texto = await res.text();
      const cuerpo = texto ? JSON.parse(texto) : null;
      return { status: res.status, cuerpo };
    } catch {
      throw new ServiceUnavailableException('users-service no disponible');
    }
  }

  // POST /internal/users -> crea el usuario
  async crearUsuario(datos: {
    nombre: string;
    correo: string;
    password_hash: string;
  }): Promise<{ creado: boolean; usuario?: UsuarioInterno }> {
    const { status, cuerpo } = await this.llamar('/internal/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });

    if (status === 201) return { creado: true, usuario: cuerpo };
    if (status === 409) return { creado: false }; // correo repetido
    throw new BadGatewayException('Respuesta inesperada de users-service');
  }

  // GET /internal/users/by-email -> devuelve el usuario (con password_hash) o null
  async buscarPorCorreo(correo: string): Promise<UsuarioInterno | null> {
    const { status, cuerpo } = await this.llamar(
      `/internal/users/by-email?correo=${encodeURIComponent(correo)}`,
    );

    if (status === 200) return cuerpo;
    if (status === 404) return null;
    throw new BadGatewayException('Respuesta inesperada de users-service');
  }
}