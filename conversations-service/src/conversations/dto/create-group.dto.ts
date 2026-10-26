import { IsNotEmpty, IsString, IsArray, MaxLength, ArrayMinSize, Matches } from 'class-validator';

export class CreateGroupDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true, message: 'Cada id_usuario debe ser un número' })
  participantes: string[];
}
