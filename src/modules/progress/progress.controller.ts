import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user';
import {
  DailyProgressQueryDto,
  ProgressHistoryQueryDto,
} from './dto/progress-query.dto';
import {
  DailyProgressResponseDto,
  ProgressHistoryResponseDto,
} from './dto/progress-response.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'progress', version: '1' })
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Consultar progresso nutricional de um dia' })
  @ApiOkResponse({ type: DailyProgressResponseDto })
  daily(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyProgressQueryDto,
  ): Promise<DailyProgressResponseDto> {
    return this.progress.daily(user.userId, query.date);
  }

  @Get('history')
  @ApiOperation({ summary: 'Listar histórico nutricional paginado' })
  @ApiOkResponse({ type: ProgressHistoryResponseDto })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ProgressHistoryQueryDto,
  ): Promise<ProgressHistoryResponseDto> {
    return this.progress.history(user.userId, query);
  }

  @Post('reprocess')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reprocessar um snapshot diário de modo idempotente',
  })
  @ApiOkResponse({ type: DailyProgressResponseDto })
  reprocess(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DailyProgressQueryDto,
  ): Promise<DailyProgressResponseDto> {
    return this.progress.reprocess(user.userId, query.date);
  }
}
