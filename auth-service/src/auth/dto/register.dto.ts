import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(150)
  correo: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}