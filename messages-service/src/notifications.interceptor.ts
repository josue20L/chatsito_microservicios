import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tap } from 'rxjs';

@Injectable()
export class NotificationsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(NotificationsInterceptor.name);
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<{ method: string; path: string }>();
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method) ||
        !/^\/api\/(conversations|messages)(\/|$)/.test(request.path)) return next.handle();
    return next.handle().pipe(tap((result: unknown) => {
      const data = result as {
        id_conversacion?: string; id_mensaje?: string; id_remitente?: string; marcados?: number;
      } | null;
      const conversationId = data?.id_conversacion?.toString() ??
        /^\/api\/conversations\/(\d+)/.exec(request.path)?.[1];
      if (!conversationId || !/^\d+$/.test(conversationId) || data?.marcados === 0) return;
      const kind = request.path.endsWith('/read') ? 'read' :
        /messages/.test(request.path) ? 'message' : 'conversation';
      const created = request.method === 'POST' && data?.id_mensaje && data.id_remitente
        ? { messageId: String(data.id_mensaje), senderId: String(data.id_remitente) } : {};
      // Una notificación fallida nunca cambia el resultado de una escritura confirmada.
      void this.notify({ conversationId, kind, ...created });
    }));
  }

  private async notify(event: object): Promise<void> {
    try {
      const base = this.config.get<string>('NOTIFICATIONS_SERVICE_URL') ?? 'http://localhost:3006';
      const response = await fetch(`${base}/internal/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) this.logger.warn(`Notificaciones no disponibles: HTTP ${response.status}`);
    } catch {
      this.logger.warn('Notificaciones no disponibles; operación guardada correctamente');
    }
  }
}

