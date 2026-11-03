import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UsersClient } from './users.client.js';
import { ConversationsClient } from './conversations.client.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';
import { ForwardMessageDto } from './dto/forward-message.dto.js';
import { MessageResponse, Archivo } from './interfaces/message-response.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { MediaClient } from './media.client.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersClient: UsersClient,
    private readonly conversationsClient: ConversationsClient,
    private readonly mediaClient: MediaClient,
  ) {}

  async createMessage(
    conversationId: string,
    dto: CreateMessageDto,
    user: CurrentUser,
  ): Promise<MessageResponse> {
    const participa = await this.conversationsClient.esParticipante(
      conversationId,
      user.id_usuario,
    );
    if (!participa) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    const nombres = await this.usersClient.obtenerNombres([user.id_usuario]);
    const nombreRemitente = nombres.get(user.id_usuario) || '';

    const mensaje = await this.prisma.mensajes.create({
      data: {
        id_conversacion: BigInt(conversationId),
        id_remitente: BigInt(user.id_usuario),
        contenido: dto.contenido,
        tipo: 'texto',
      },
      include: {
        lecturas_mensajes: true,
      },
    });

    return this.toMessageResponse(mensaje, nombreRemitente);
  }

  async getMessages(
    conversationId: string,
    user: CurrentUser,
    limit?: string,
    antesDe?: string,
    despuesDe?: string,
  ): Promise<MessageResponse[]> {
    const participa = await this.conversationsClient.esParticipante(
      conversationId,
      user.id_usuario,
    );
    if (!participa) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    const limitNumber = Math.min(parseInt(limit || '50', 10), 100);
    const where = { id_conversacion: BigInt(conversationId) };

    let mensajes;
    if (antesDe) {
      mensajes = await this.prisma.mensajes.findMany({
        where: { ...where, id_mensaje: { lt: BigInt(antesDe) } },
        orderBy: { id_mensaje: 'desc' },
        take: limitNumber,
        include: {
          lecturas_mensajes: true,
        },
      });
    } else if (despuesDe) {
      mensajes = await this.prisma.mensajes.findMany({
        where: { ...where, id_mensaje: { gt: BigInt(despuesDe) } },
        orderBy: { id_mensaje: 'asc' },
        take: limitNumber,
        include: {
          lecturas_mensajes: true,
        },
      });
    } else {
      mensajes = await this.prisma.mensajes.findMany({
        where,
        orderBy: { id_mensaje: 'desc' },
        take: limitNumber,
        include: {
          lecturas_mensajes: true,
        },
      });
    }

    mensajes.reverse();

    const remitentesUnicos = [...new Set(mensajes.map((m) => m.id_remitente.toString()))];
    const nombres = await this.usersClient.obtenerNombres(remitentesUnicos);
    const audioIds = mensajes
      .filter((mensaje) => mensaje.tipo === 'audio')
      .map((mensaje) => mensaje.id_mensaje.toString());
    const archivos = await this.mediaClient.obtenerArchivos(audioIds);

    return mensajes.map((m) => {
      const nombre = nombres.get(m.id_remitente.toString()) || '';
      return this.toMessageResponse(
        m,
        nombre,
        archivos.get(m.id_mensaje.toString()) ?? null,
      );
    });
  }

  async updateMessage(
    messageId: string,
    dto: UpdateMessageDto,
    user: CurrentUser,
  ): Promise<MessageResponse> {
    const mensaje = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });

    if (!mensaje) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (mensaje.id_remitente.toString() !== user.id_usuario) {
      throw new ForbiddenException('Solo el remitente puede editar el mensaje');
    }

    if (mensaje.eliminado_en) {
      throw new BadRequestException('El mensaje fue eliminado');
    }

    if (mensaje.tipo !== 'texto') {
      throw new BadRequestException('Solo se pueden editar mensajes de texto');
    }

    if (Date.now() >= mensaje.fecha_envio.getTime() + 10 * 60 * 1000) {
      throw new ForbiddenException('El plazo de 10 minutos para editar este mensaje ha terminado');
    }

    const actualizado = await this.prisma.mensajes.update({
      where: { id_mensaje: BigInt(messageId) },
      data: {
        contenido: dto.contenido,
        editado_en: new Date(),
      },
      include: {
        lecturas_mensajes: true,
      },
    });

    const nombres = await this.usersClient.obtenerNombres([user.id_usuario]);
    const nombreRemitente = nombres.get(user.id_usuario) || '';

    return this.toMessageResponse(actualizado, nombreRemitente);
  }

  async deleteMessage(
    messageId: string,
    user: CurrentUser,
  ): Promise<{ id_mensaje: string; id_conversacion: string }> {
    const mensaje = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });

    if (!mensaje) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (mensaje.id_remitente.toString() !== user.id_usuario) {
      throw new ForbiddenException('Solo el autor puede eliminar el mensaje');
    }

    if (mensaje.eliminado_en) {
      return {
        id_mensaje: messageId,
        id_conversacion: mensaje.id_conversacion.toString(),
      };
    }

    if (Date.now() >= mensaje.fecha_envio.getTime() + 5 * 60 * 1000) {
      throw new ForbiddenException('El plazo de 5 minutos para eliminar este mensaje ha terminado');
    }

    const contenidoNuevo = mensaje.tipo === 'texto' ? 'Este mensaje fue eliminado' : null;

    await this.prisma.mensajes.update({
      where: { id_mensaje: BigInt(messageId) },
      data: {
        eliminado_en: new Date(),
        contenido: contenidoNuevo,
      },
    });

    return {
      id_mensaje: messageId,
      id_conversacion: mensaje.id_conversacion.toString(),
    };
  }

  async forwardMessage(
    messageId: string,
    dto: ForwardMessageDto,
    user: CurrentUser,
  ): Promise<MessageResponse> {
    const original = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: BigInt(messageId) },
    });

    if (!original) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (original.eliminado_en) {
      throw new BadRequestException('El mensaje fue eliminado');
    }

    if (original.tipo !== 'texto') {
      throw new BadRequestException('Solo se pueden reenviar mensajes de texto');
    }

    const participaOrigen = await this.conversationsClient.esParticipante(
      original.id_conversacion.toString(),
      user.id_usuario,
    );
    if (!participaOrigen) {
      throw new ForbiddenException('No tienes acceso al mensaje original');
    }

    const participaDestino = await this.conversationsClient.esParticipante(
      dto.id_conversacion,
      user.id_usuario,
    );
    if (!participaDestino) {
      throw new ForbiddenException('No eres participante de la conversación destino');
    }

    const nuevo = await this.prisma.mensajes.create({
      data: {
        id_conversacion: BigInt(dto.id_conversacion),
        id_remitente: BigInt(user.id_usuario),
        contenido: original.contenido,
        tipo: 'texto',
        reenviado_de_id: original.id_mensaje,
      },
      include: {
        lecturas_mensajes: true,
      },
    });

    const nombres = await this.usersClient.obtenerNombres([user.id_usuario]);
    const nombreRemitente = nombres.get(user.id_usuario) || '';

    return this.toMessageResponse(nuevo, nombreRemitente);
  }

  async markAsRead(
    conversationId: string,
    user: CurrentUser,
  ): Promise<{ marcados: number }> {
    const participa = await this.conversationsClient.esParticipante(
      conversationId,
      user.id_usuario,
    );
    if (!participa) {
      throw new NotFoundException('Conversación no encontrada o no eres participante');
    }

    const mensajesSinLeer = await this.prisma.mensajes.findMany({
      where: {
        id_conversacion: BigInt(conversationId),
        id_remitente: { not: BigInt(user.id_usuario) },
        lecturas_mensajes: {
          none: { id_usuario: BigInt(user.id_usuario) },
        },
      },
      select: { id_mensaje: true },
    });

    if (mensajesSinLeer.length === 0) {
      return { marcados: 0 };
    }

    await this.prisma.lecturas_mensajes.createMany({
      data: mensajesSinLeer.map((m) => ({
        id_conversacion: BigInt(conversationId),
        id_mensaje: m.id_mensaje,
        id_usuario: BigInt(user.id_usuario),
      })),
      skipDuplicates: true,
    });

    return { marcados: mensajesSinLeer.length };
  }

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const count = await this.prisma.mensajes.count({
      where: {
        id_conversacion: BigInt(conversationId),
        id_remitente: { not: BigInt(userId) },
        lecturas_mensajes: {
          none: { id_usuario: BigInt(userId) },
        },
      },
    });
    return count;
  }

  async createAudioMessage(body: {
    id_conversacion: string;
    id_remitente: string;
    reenviado_de_id?: string;
    archivo: Archivo;
  }): Promise<MessageResponse> {
    const mensaje = await this.prisma.mensajes.create({
      data: {
        id_conversacion: BigInt(body.id_conversacion),
        id_remitente: BigInt(body.id_remitente),
        contenido: null,
        tipo: 'audio',
        reenviado_de_id: body.reenviado_de_id ? BigInt(body.reenviado_de_id) : null,
      },
      include: {
        lecturas_mensajes: true,
      },
    });

    return this.toMessageResponse(mensaje, '', body.archivo);
  }

  async getMessageBasicInfo(id: string): Promise<{ id_mensaje: string; id_conversacion: string; id_remitente: string; tipo: string; eliminado_en: Date | null }> {
    const mensaje = await this.prisma.mensajes.findUnique({
      where: { id_mensaje: BigInt(id) },
    });

    if (!mensaje) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    return {
      id_mensaje: mensaje.id_mensaje.toString(),
      id_conversacion: mensaje.id_conversacion.toString(),
      id_remitente: mensaje.id_remitente.toString(),
      tipo: mensaje.tipo,
      eliminado_en: mensaje.eliminado_en,
    };
  }

  async deleteMessageInternal(id: string): Promise<void> {
    await this.prisma.mensajes.delete({
      where: { id_mensaje: BigInt(id) },
    });
  }

  private toMessageResponse(
    mensaje: any,
    nombreRemitente: string,
    archivo: Archivo | null = null,
  ): MessageResponse {
    return {
      id_mensaje: mensaje.id_mensaje.toString(),
      id_conversacion: mensaje.id_conversacion.toString(),
      id_remitente: mensaje.id_remitente.toString(),
      contenido: mensaje.contenido,
      tipo: mensaje.tipo,
      fecha_envio: mensaje.fecha_envio,
      eliminado_en: mensaje.eliminado_en,
      editado_en: mensaje.editado_en,
      reenviado_de_id: mensaje.reenviado_de_id?.toString() || null,
      remitente: {
        id_usuario: mensaje.id_remitente.toString(),
        nombre: nombreRemitente,
      },
      leido_por: mensaje.lecturas_mensajes.map((l: any) => l.id_usuario.toString()),
      archivo,
    };
  }
}
