import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UploadAudioDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(86400)
  duracion_segundos?: number;
}
