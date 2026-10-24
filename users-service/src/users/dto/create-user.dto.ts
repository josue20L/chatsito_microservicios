import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  correo: string;

  @IsString()
  @IsNotEmpty()
  password_hash: string;
}
