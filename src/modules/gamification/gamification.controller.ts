import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../../shared/http/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import {
  AchievementProgressDto,
  DailyMissionProgressDto,
  GamificationSummaryDto,
  PointLedgerResponseDto,
} from './dto/gamification-response.dto';
import { MissionQueryDto } from './dto/mission-query.dto';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'gamification', version: '1' })
export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Consultar streak e saldo reconciliado' })
  @ApiOkResponse({ type: GamificationSummaryDto })
  summary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GamificationSummaryDto> {
    return this.service.summary(user.userId);
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Consultar ledger imutável de pontos' })
  @ApiOkResponse({ type: PointLedgerResponseDto })
  ledger(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PointLedgerResponseDto> {
    return this.service.ledger(user.userId, query);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'Listar conquistas desbloqueadas' })
  @ApiOkResponse({ type: [AchievementProgressDto] })
  achievements(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AchievementProgressDto[]> {
    return this.service.achievements(user.userId);
  }

  @Get('missions')
  @ApiOperation({ summary: 'Consultar missões diárias e recompensas' })
  @ApiOkResponse({ type: [DailyMissionProgressDto] })
  missions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MissionQueryDto,
  ): Promise<DailyMissionProgressDto[]> {
    return this.service.missions(user.userId, query.date);
  }

  @Post('reprocess')
  @ApiOperation({
    summary: 'Reprocessar eventos pendentes de forma idempotente',
  })
  async reprocess(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ processed: number }> {
    return { processed: await this.service.processPendingForUser(user.userId) };
  }
}
