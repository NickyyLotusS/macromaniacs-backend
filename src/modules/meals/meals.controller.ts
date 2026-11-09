import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
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
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import {
  CheckInPlannedMealDto,
  CreateManualMealDto,
} from './dto/create-meal.dto';
import { ListMealsQueryDto } from './dto/list-meals-query.dto';
import { MealListResponseDto, MealResponseDto } from './dto/meal-response.dto';
import { UpdateMealDto } from './dto/update-meal.dto';
import { MealsService } from './meals.service';

@ApiTags('meals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'meals', version: '1' })
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Registrar uma refeição consumida manualmente' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: MealResponseDto })
  @ApiBadRequestResponse({
    description: 'Payload ou chave idempotente inválida',
  })
  createManual(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateManualMealDto,
  ): Promise<MealResponseDto> {
    return this.meals.createManual(user.userId, idempotencyKey, dto);
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Confirmar consumo de uma refeição planejada' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: MealResponseDto })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CheckInPlannedMealDto,
  ): Promise<MealResponseDto> {
    return this.meals.checkIn(user.userId, idempotencyKey, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar histórico próprio de refeições consumidas' })
  @ApiOkResponse({ type: MealListResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMealsQueryDto,
  ): Promise<MealListResponseDto> {
    return this.meals.list(user.userId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: MealResponseDto })
  @ApiNotFoundResponse({ description: 'Refeição não encontrada' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MealResponseDto> {
    return this.meals.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: MealResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMealDto,
  ): Promise<MealResponseDto> {
    return this.meals.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Refeição removida logicamente' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.meals.remove(user.userId, id);
  }
}
