// Rutas internas: no se exponen por el gateway
import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Controller('internal/users')
export class InternalUsersController {
  constructor(private usersService: UsersService) {}

  @Get('by-email')
  async findByEmail(@Query('correo') correo: string) {
    if (!correo) {
      throw new HttpException('correo es requerido', HttpStatus.BAD_REQUEST);
    }
    const user = await this.usersService.findByEmail(correo);
    if (!user) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Get()
  async findByIds(@Query('ids') ids: string) {
    if (!ids) {
      return [];
    }
    const idArray = ids.split(',');
    for (const id of idArray) {
      if (!/^\d+$/.test(id)) {
        throw new HttpException('ids deben ser enteros positivos', HttpStatus.BAD_REQUEST);
      }
    }
    return this.usersService.findByIds(idArray);
  }

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }
}
