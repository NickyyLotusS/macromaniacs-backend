import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import { CreatePlannedMealDto } from './dto/create-planned-meal.dto';
import {
  CreatePlannedMealItemDto,
  UpdatePlannedMealItemDto,
} from './dto/planned-meal-item.dto';
import {
  PlannedMealItemResponseDto,
  PlannedMealResponseDto,
  PlannedMealsResponseDto,
} from './dto/planned-meal-response.dto';
import { UpdatePlannedMealDto } from './dto/update-planned-meal.dto';
import { PlannedMealsService } from './planned-meals.service';

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('diet-plans')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado' })
@ApiNotFoundResponse({
  description: 'Plano, refeição ou alimento não encontrado',
})
@UseGuards(JwtAuthGuard)
@Controller({ path: 'diet-plans/:planId/meals', version: '1' })
export class PlannedMealsController {
  constructor(private readonly plannedMeals: PlannedMealsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar refeições, itens e totais previstos do plano',
  })
  @ApiOkResponse({ type: PlannedMealsResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
  ): Promise<PlannedMealsResponseDto> {
    return this.plannedMeals.list(user.userId, planId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar refeição planejada' })
  @ApiCreatedResponse({ type: PlannedMealResponseDto })
  @ApiBadRequestResponse({ description: 'Nome, ordem ou metas inválidos' })
  @ApiConflictResponse({ description: 'Ordem já usada no plano' })
  createMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Body() dto: CreatePlannedMealDto,
  ): Promise<PlannedMealResponseDto> {
    return this.plannedMeals.createMeal(user.userId, planId, dto);
  }

  @Patch(':mealId')
  @ApiOperation({ summary: 'Atualizar refeição planejada' })
  @ApiOkResponse({ type: PlannedMealResponseDto })
  @ApiBadRequestResponse({ description: 'Payload vazio ou inválido' })
  @ApiConflictResponse({ description: 'Ordem já usada no plano' })
  updateMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Param('mealId', uuid) mealId: string,
    @Body() dto: UpdatePlannedMealDto,
  ): Promise<PlannedMealResponseDto> {
    return this.plannedMeals.updateMeal(user.userId, planId, mealId, dto);
  }

  @Delete(':mealId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover refeição planejada e seus itens' })
  @ApiNoContentResponse()
  async deleteMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Param('mealId', uuid) mealId: string,
  ): Promise<void> {
    await this.plannedMeals.deleteMeal(user.userId, planId, mealId);
  }

  @Post(':mealId/items')
  @ApiOperation({
    summary: 'Adicionar alimento e snapshot nutricional à refeição',
  })
  @ApiCreatedResponse({ type: PlannedMealItemResponseDto })
  @ApiBadRequestResponse({
    description: 'Quantidade ou macros calculados inválidos',
  })
  createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Param('mealId', uuid) mealId: string,
    @Body() dto: CreatePlannedMealItemDto,
  ): Promise<PlannedMealItemResponseDto> {
    return this.plannedMeals.createItem(user.userId, planId, mealId, dto);
  }

  @Patch(':mealId/items/:itemId')
  @ApiOperation({
    summary: 'Atualizar alimento ou quantidade do item planejado',
  })
  @ApiOkResponse({ type: PlannedMealItemResponseDto })
  @ApiBadRequestResponse({
    description: 'Payload vazio, quantidade ou macros inválidos',
  })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Param('mealId', uuid) mealId: string,
    @Param('itemId', uuid) itemId: string,
    @Body() dto: UpdatePlannedMealItemDto,
  ): Promise<PlannedMealItemResponseDto> {
    return this.plannedMeals.updateItem(
      user.userId,
      planId,
      mealId,
      itemId,
      dto,
    );
  }

  @Delete(':mealId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover item e atualizar os totais calculados' })
  @ApiNoContentResponse()
  async deleteItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', uuid) planId: string,
    @Param('mealId', uuid) mealId: string,
    @Param('itemId', uuid) itemId: string,
  ): Promise<void> {
    await this.plannedMeals.deleteItem(user.userId, planId, mealId, itemId);
  }
}
