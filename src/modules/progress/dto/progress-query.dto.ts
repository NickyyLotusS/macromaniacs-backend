import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DailyProgressQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-11-08' })
  @IsOptional()
  @IsISO8601({ strict: true })
  date?: string;
}

export class ProgressHistoryQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-11-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-30' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
