import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { InternalUsersController } from './internal-users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController, InternalUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
