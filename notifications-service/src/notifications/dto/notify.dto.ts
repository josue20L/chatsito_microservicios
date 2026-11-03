import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class NotifyDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsIn(['message', 'read', 'conversation'])
  kind: 'message' | 'read' | 'conversation';
}
