import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateManualFoodDto } from './dto/create-manual-food.dto';
import { FoodListResponseDto, FoodResponseDto } from './dto/food-response.dto';
import { SearchFoodsQueryDto } from './dto/search-foods-query.dto';
import { FoodCacheService } from './food-cache.service';
import { FoodLookupService } from './food-lookup.service';

@ApiTags('foods')
@Controller({ path: 'foods', version: '1' })
export class FoodProductsController {
  constructor(
    private readonly foodCache: FoodCacheService,
    private readonly lookup: FoodLookupService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Buscar alimentos locais e em provedores ativos' })
  @ApiOkResponse({ type: FoodListResponseDto })
  search(@Query() query: SearchFoodsQueryDto): Promise<FoodListResponseDto> {
    return this.lookup.search(query);
  }

  @Get('barcode/:barcode')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Consultar alimento por código de barras' })
  @ApiParam({ name: 'barcode', example: '7891234567890' })
  @ApiOkResponse({ type: FoodResponseDto })
  byBarcode(@Param('barcode') barcode: string): Promise<FoodResponseDto> {
    return this.lookup.byBarcode(barcode);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Detalhar alimento do catálogo canônico' })
  @ApiOkResponse({ type: FoodResponseDto })
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<FoodResponseDto> {
    return this.lookup.get(id);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
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
