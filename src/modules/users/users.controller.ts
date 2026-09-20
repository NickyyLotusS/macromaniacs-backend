import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { MyProfileResponseDto } from './dto/user-profile-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Consultar o próprio perfil nutricional' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  getMe(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<MyProfileResponseDto> {
    return this.usersService.getMe(currentUser.userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Atualizar o próprio perfil e recalcular métricas nutricionais',
  })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Dados corporais ou perfil inválidos' })
  @ApiConflictResponse({ description: 'Username já utilizado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<MyProfileResponseDto> {
    return this.usersService.updateMe(currentUser.userId, dto);
  }
}
