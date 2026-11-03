import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  contenido: string;
}
