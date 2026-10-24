import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(id_usuario: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id_usuario: BigInt(id_usuario) },
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
        fecha_registro: true,
      },
    });
    if (!user) {
      return null;
    }
    return {
      ...user,
      id_usuario: user.id_usuario.toString(),
    };
  }

  async searchUsers(search: string, currentUserId: string) {
    const users = await this.prisma.usuarios.findMany({
      where: {
        AND: [
          { id_usuario: { not: BigInt(currentUserId) } },
          {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { correo: { contains: search, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 20,
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
      },
    });
    return users.map((user: any) => ({
      ...user,
      id_usuario: user.id_usuario.toString(),
    }));
  }

  async createUser(dto: CreateUserDto) {
    try {
      const user = await this.prisma.usuarios.create({
        data: {
          nombre: dto.nombre,
          correo: dto.correo,
          password_hash: dto.password_hash,
        },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          fecha_registro: true,
        },
      });
      return {
        ...user,
        id_usuario: user.id_usuario.toString(),
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async findByEmail(correo: string) {
    const user = await this.prisma.usuarios.findFirst({
      where: { correo: { equals: correo, mode: 'insensitive' } },
    });
    if (!user) {
      return null;
    }
    return {
      ...user,
      id_usuario: user.id_usuario.toString(),
    };
  }

  async findByIds(ids: string[]) {
    const users = await this.prisma.usuarios.findMany({
      where: {
        id_usuario: { in: ids.map((id) => BigInt(id)) },
      },
      select: {
        id_usuario: true,
        nombre: true,
        correo: true,
      },
    });
    return users.map((user: any) => ({
      ...user,
      id_usuario: user.id_usuario.toString(),
    }));
  }
}
