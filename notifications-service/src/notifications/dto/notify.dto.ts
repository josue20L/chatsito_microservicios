import { IsString, IsIn, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class NotifyDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsIn(['message', 'read', 'conversation'])
  kind: 'message' | 'read' | 'conversation';

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  messageId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  senderId?: string;
}
