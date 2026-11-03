import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  id_usuario: string;
  correo: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
