import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AddParticipantDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'id_usuario debe ser un número' })
  id_usuario: string;
}
