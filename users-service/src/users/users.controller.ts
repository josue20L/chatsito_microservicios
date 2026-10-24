import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() currentUser: any) {
    return this.usersService.getMe(currentUser.id_usuario);
  }

  @Get()
  searchUsers(@Query('search') search: string, @CurrentUser() currentUser: any) {
    return this.usersService.searchUsers(search || '', currentUser.id_usuario);
  }
}
