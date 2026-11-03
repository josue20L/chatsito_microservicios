import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  id_usuario: string;
  correo?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser =>
    context.switchToHttp().getRequest().user,
);
