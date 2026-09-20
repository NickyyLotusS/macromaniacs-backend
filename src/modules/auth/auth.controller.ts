import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AccessTokenResponseDto,
  AuthenticatedUserResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/authenticated-user';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastrar usuário' })
  @ApiCreatedResponse({ type: AuthenticatedUserResponseDto })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiConflictResponse({ description: 'E-mail ou username já utilizado' })
  register(@Body() dto: RegisterDto): Promise<AuthenticatedUserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário' })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas' })
  login(@Body() dto: LoginDto): Promise<AccessTokenResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter sessão atual' })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
  me(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<AuthenticatedUserResponseDto> {
    return this.authService.me(currentUser.userId);
  }
}
