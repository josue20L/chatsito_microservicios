import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: 'http://localhost:5173' },
  transports: ['websocket'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket: any, next: (err?: Error) => void) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          const err = new Error('No autorizado') as any;
          err.data = { message: 'No autorizado' };
          return next(err);
        }

        const secret = this.configService.get<string>('JWT_SECRET');
        if (!secret) {
          const err = new Error('No autorizado') as any;
          err.data = { message: 'No autorizado' };
          return next(err);
        }

        const payload = await this.jwtService.verifyAsync(token, { secret });
        const sub = payload.sub;

        if (!/^\d+$/.test(String(sub))) {
          const err = new Error('No autorizado') as any;
          err.data = { message: 'No autorizado' };
          return next(err);
        }

        socket.userId = String(sub);
        socket.join(`user:${sub}`);

        const exp = payload.exp;
        if (exp) {
          const now = Math.floor(Date.now() / 1000);
          const timeout = (exp - now) * 1000;
          if (timeout > 0) {
            setTimeout(() => {
              socket.disconnect(true);
            }, timeout);
          }
        }

        next();
      } catch (e) {
        const err = new Error('No autorizado') as any;
        err.data = { message: 'No autorizado' };
        next(err);
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // Emite a los participantes de una conversación
  async changed(conversationId: string, kind: 'message' | 'read' | 'conversation') {
    const conversationsUrl = this.configService.get<string>('CONVERSATIONS_SERVICE_URL');
    if (!conversationsUrl) {
      this.logger.error('CONVERSATIONS_SERVICE_URL no está definido');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(
        `${conversationsUrl}/internal/conversations/${conversationId}/participants`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.error(
          `Error al obtener participantes: ${response.status} ${response.statusText}`,
        );
        return;
      }

      const data = await response.json();
      const participantes: string[] = data.participantes || [];

      for (const id of participantes) {
        this.server.to(`user:${id}`).emit('chat:changed', {
          conversationId,
          kind,
        });
      }
    } catch (error) {
      this.logger.error('Error al notificar a participantes:', error);
    }
  }
}
