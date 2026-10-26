import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UsersClient } from './users.client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreatePrivateDto } from './dto/create-private.dto.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { AddParticipantDto } from './dto/add-participant.dto.js';

type ConversacionConParticipantes = {
  id_conversacion: bigint;
  tipo: string;
  nombre: string | null;
  fecha_creacion: Date;
  participantes: { id_usuario: bigint; fecha_union: Date }[];
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersClient: UsersClient,
  ) {}

  // Arma la respuesta con los nombres que vienen de users-service
  private armarRespuesta(
    conv: ConversacionConParticipantes,
    nombres: Map<string, string>,
    conFechaUnion: boolean,
  ) {
    return {
      id_conversacion: conv.id_conversacion.toString(),
      tipo: conv.tipo,
      nombre: conv.nombre,
      fecha_creacion: conv.fecha_creacion,
      participantes: conv.participantes.map((p) => {
        const id = p.id_usuario.toString();
        return conFechaUnion
          ? { id_usuario: id, nombre: nombres.get(id) ?? '', fecha_union: p.fecha_union }
          : { id_usuario: id, nombre: nombres.get(id) ?? '' };
      }),
    };
  }

  async createPrivate(dto: CreatePrivateDto, currentUser: CurrentUser) {
    const otherUserId = BigInt(dto.id_usuario);
    const myId = BigInt(currentUser.id_usuario);

    if (otherUserId === myId) {
      throw new ConflictException('No puedes crear una conversación contigo mismo');
    }

    // Una sola llamada a users-service: valida al otro usuario y trae ambos nombres
    const nombres = await this.usersClient.obtenerNombres([
      dto.id_usuario,
      currentUser.id_usuario,
    ]);
    if (!nombres.has(dto.id_usuario)) {
      throw new NotFoundException('El usuario no existe');
    }

    // Si ya existe una privada entre ambos, se devuelve esa
    const existente = await this.prisma.conversaciones.findFirst({
      where: {
        tipo: 'privada',
        participantes: { some: { id_usuario: myId } },
        AND: { participantes: { some: { id_usuario: otherUserId } } },
      },
      include: { participantes: true },
    });
    if (existente) {
      return this.armarRespuesta(existente, nombres, false);
    }

    const creada = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.conversaciones.create({ data: { tipo: 'privada' } });
      await tx.participantes.createMany({
        data: [
          { id_conversacion: nueva.id_conversacion, id_usuario: myId },
          { id_conversacion: nueva.id_conversacion, id_usuario: otherUserId },
        ],
      });
      return nueva;
    });

    const completa = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: creada.id_conversacion },
      include: { participantes: true },
    });
    if (!completa) {
      throw new NotFoundException('Error al crear la conversación');
    }
    return this.armarRespuesta(completa, nombres, false);
  }

  async createGroup(dto: CreateGroupDto, currentUser: CurrentUser) {
    const participantIds = dto.participantes.map((id) => BigInt(id));

    const nombres = await this.usersClient.obtenerNombres([
      ...dto.participantes,
      currentUser.id_usuario,
    ]);

    // Igual que el monolito: todos deben existir y no puede haber repetidos
    const unicos = new Set(dto.participantes);
    if (unicos.size !== dto.participantes.length || [...unicos].some((id) => !nombres.has(id))) {
      throw new NotFoundException('Algunos usuarios no existen');
    }

    const creada = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.conversaciones.create({
        data: { tipo: 'grupo', nombre: dto.nombre },
      });
      await tx.participantes.create({
        data: {
          id_conversacion: nueva.id_conversacion,
          id_usuario: BigInt(currentUser.id_usuario),
        },
      });
      await tx.participantes.createMany({
        data: participantIds.map((id) => ({
          id_conversacion: nueva.id_conversacion,
          id_usuario: id,
        })),
      });
      return nueva;
    });

    const completa = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: creada.id_conversacion },
      include: { participantes: true },
    });
    if (!completa) {
      throw new NotFoundException('Error al crear la conversación');
    }
    return this.armarRespuesta(completa, nombres, false);
  }

  async findAll(currentUser: CurrentUser) {
    const conversaciones = await this.prisma.conversaciones.findMany({
      where: {
        participantes: { some: { id_usuario: BigInt(currentUser.id_usuario) } },
      },
      include: { participantes: true },
      orderBy: { fecha_creacion: 'desc' },
    });

    // Una sola llamada para todos los nombres de todas las conversaciones
    const ids = conversaciones.flatMap((c) =>
      c.participantes.map((p) => p.id_usuario.toString()),
    );
    const nombres = await this.usersClient.obtenerNombres(ids);

    return conversaciones.map((c) => this.armarRespuesta(c, nombres, false));
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const conversacion = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: BigInt(id) },
      include: { participantes: true },
    });
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const esParticipante = conversacion.participantes.some(
      (p) => p.id_usuario === BigInt(currentUser.id_usuario),
    );
    if (!esParticipante) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const nombres = await this.usersClient.obtenerNombres(
      conversacion.participantes.map((p) => p.id_usuario.toString()),
    );
    return this.armarRespuesta(conversacion, nombres, true);
  }

  async addParticipant(id: string, dto: AddParticipantDto, currentUser: CurrentUser) {
    const conversationId = BigInt(id);
    const newUserId = BigInt(dto.id_usuario);

    const conversacion = await this.prisma.conversaciones.findUnique({
      where: { id_conversacion: conversationId },
      include: { participantes: true },
    });
    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }
    if (conversacion.tipo !== 'grupo') {
      throw new ForbiddenException('Solo se pueden agregar participantes a grupos');
    }

    const esParticipante = conversacion.participantes.some(
      (p) => p.id_usuario === BigInt(currentUser.id_usuario),
    );
    if (!esParticipante) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const nombres = await this.usersClient.obtenerNombres([dto.id_usuario]);
    if (!nombres.has(dto.id_usuario)) {
      throw new NotFoundException('El usuario no existe');
    }

    if (conversacion.participantes.some((p) => p.id_usuario === newUserId)) {
      throw new ConflictException('El usuario ya es participante');
    }

    const participante = await this.prisma.participantes.create({
      data: { id_conversacion: conversationId, id_usuario: newUserId },
    });

    return {
      id_usuario: participante.id_usuario.toString(),
      nombre: nombres.get(dto.id_usuario) ?? '',
      fecha_union: participante.fecha_union,
    };
  }

  // Lo usa messages-service (ruta interna) en lugar de consultar la tabla
  async esParticipante(idConversacion: string, idUsuario: string): Promise<boolean> {
    const p = await this.prisma.participantes.findUnique({
      where: {
        id_conversacion_id_usuario: {
          id_conversacion: BigInt(idConversacion),
          id_usuario: BigInt(idUsuario),
        },
      },
    });
    return p !== null;
  }
}
