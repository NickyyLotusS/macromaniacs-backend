import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PointTransactionReason } from '../../../integrations/database/entities/enums';
import { PaginationMetaDto } from '../../../shared/http/pagination.dto';

export class GamificationSummaryDto {
  @ApiProperty() currentStreak!: number;
  @ApiProperty() bestStreak!: number;
  @ApiProperty() totalPoints!: number;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  lastActivityDate!: string | null;
  @ApiProperty() timezone!: string;
  @ApiProperty() scoringVersion!: string;
}

export class PointTransactionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() amount!: number;
  @ApiProperty({ enum: PointTransactionReason })
  reason!: PointTransactionReason;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) sourceType!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sourceId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class PointLedgerResponseDto {
  @ApiProperty({ type: [PointTransactionDto] }) items!: PointTransactionDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class AchievementProgressDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ format: 'date-time' }) unlockedAt!: string;
}

export class DailyMissionProgressDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty() currentProgress!: number;
  @ApiProperty() targetCount!: number;
  @ApiProperty() pointsReward!: number;
  @ApiProperty() completed!: boolean;
  @ApiProperty() rewardGranted!: boolean;
}
