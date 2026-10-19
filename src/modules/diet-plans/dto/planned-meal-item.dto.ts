import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_ITEM_AMOUNT_GRAMS = 9_999.99;

export class CreatePlannedMealItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  foodId!: string;

  @ApiProperty({ example: 120.5, minimum: 0.01, maximum: 9999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_ITEM_AMOUNT_GRAMS)
  amountGrams!: number;
}

export class UpdatePlannedMealItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  foodId?: string;

  @ApiPropertyOptional({ example: 150, minimum: 0.01, maximum: 9999.99 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_ITEM_AMOUNT_GRAMS)
  amountGrams?: number;
}
