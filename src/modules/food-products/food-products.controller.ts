import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateManualFoodDto } from './dto/create-manual-food.dto';
import { FoodResponseDto } from './dto/food-response.dto';
import { FoodCacheService } from './food-cache.service';

@ApiTags('foods')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'foods', version: '1' })
export class FoodProductsController {
  constructor(private readonly foodCache: FoodCacheService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Cadastrar alimento manual validado' })
  @ApiCreatedResponse({ type: FoodResponseDto })
  @ApiBadRequestResponse({ description: 'Dados nutricionais inválidos' })
  @ApiConflictResponse({ description: 'Código de barras já cadastrado' })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  async createManual(
    @Body() dto: CreateManualFoodDto,
  ): Promise<FoodResponseDto> {
    return FoodResponseDto.from(await this.foodCache.createManual(dto));
  }
}
