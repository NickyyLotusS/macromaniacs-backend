import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { DietPlansService } from './diet-plans.service';
import { CreateDietPlanDto } from './dto/create-diet-plan.dto';
import {
  DietPlanListResponseDto,
  DietPlanResponseDto,
} from './dto/diet-plan-response.dto';
import { ListDietPlansQueryDto } from './dto/list-diet-plans-query.dto';
import { UpdateDietPlanDto } from './dto/update-diet-plan.dto';

@ApiTags('diet-plans')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
@UseGuards(JwtAuthGuard)
@Controller({ path: 'diet-plans', version: '1' })
export class DietPlansController {
  constructor(private readonly dietPlans: DietPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Criar plano alimentar em rascunho' })
  @ApiCreatedResponse({ type: DietPlanResponseDto })
  @ApiBadRequestResponse({ description: 'Metas ou período inválidos' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDietPlanDto,
  ): Promise<DietPlanResponseDto> {
    return this.dietPlans.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar os próprios planos alimentares' })
  @ApiOkResponse({ type: DietPlanListResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDietPlansQueryDto,
  ): Promise<DietPlanListResponseDto> {
    return this.dietPlans.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar um plano alimentar próprio' })
  @ApiOkResponse({ type: DietPlanResponseDto })
  @ApiNotFoundResponse({ description: 'Plano não encontrado para o usuário' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DietPlanResponseDto> {
    return this.dietPlans.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um plano alimentar próprio' })
  @ApiOkResponse({ type: DietPlanResponseDto })
  @ApiBadRequestResponse({ description: 'Metas ou período inválidos' })
  @ApiNotFoundResponse({ description: 'Plano não encontrado para o usuário' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDietPlanDto,
  ): Promise<DietPlanResponseDto> {
    return this.dietPlans.update(user.userId, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar plano e arquivar o ativo anterior' })
  @ApiOkResponse({ type: DietPlanResponseDto })
  @ApiNotFoundResponse({ description: 'Plano não encontrado para o usuário' })
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DietPlanResponseDto> {
    return this.dietPlans.activate(user.userId, id);
  }
}
