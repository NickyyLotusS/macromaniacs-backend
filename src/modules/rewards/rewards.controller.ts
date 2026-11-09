import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import {
  InventoryItemDto,
  PointsBalanceDto,
  PurchaseResponseDto,
  RewardItemDto,
} from './dto/reward-response.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@Controller({ path: 'rewards', version: '1' })
export class RewardsController {
  constructor(private readonly service: RewardsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Listar recompensas ativas' })
  @ApiOkResponse({ type: [RewardItemDto] })
  catalog(): Promise<RewardItemDto[]> {
    return this.service.listCatalog();
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: PointsBalanceDto })
  balance(@CurrentUser() user: AuthenticatedUser): Promise<PointsBalanceDto> {
    return this.service.balance(user.userId);
  }

  @Get('inventory')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: [InventoryItemDto] })
  inventory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InventoryItemDto[]> {
    return this.service.inventory(user.userId);
  }

  @Post('purchases/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: PurchaseResponseDto })
  purchase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PurchaseResponseDto> {
    return this.service.purchase(user.userId, itemId, idempotencyKey);
  }

  @Put('inventory/:itemId/equip')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: InventoryItemDto })
  equip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<InventoryItemDto> {
    return this.service.equip(user.userId, itemId);
  }
}
