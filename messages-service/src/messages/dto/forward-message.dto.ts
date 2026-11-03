import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ForwardMessageDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'id_conversacion debe ser un número' })
  id_conversacion: string;
}
