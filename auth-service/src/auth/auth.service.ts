import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsersClient } from './users.client.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersClient: UsersClient,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const resultado = await this.usersClient.crearUsuario({
      nombre: dto.nombre,
      correo: correoNormalizado,
      password_hash: passwordHash,
    });

    if (!resultado.creado) {
      throw new ConflictException('El correo ya está registrado');
    }

    const usuario = resultado.usuario!;
    return {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      fecha_registro: usuario.fecha_registro,
    };
  }

  async login(dto: LoginDto) {
    const correoNormalizado = dto.correo.toLowerCase().trim();
    const usuario = await this.usersClient.buscarPorCorreo(correoNormalizado);

    if (!usuario || !usuario.password_hash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await bcrypt.compare(dto.password, usuario.password_hash);
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Mismo payload que el monolito
    const payload = { sub: usuario.id_usuario, correo: usuario.correo };
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
      },
    };
  }
}