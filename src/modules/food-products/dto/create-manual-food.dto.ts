import { Transform, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MAX_DATABASE_DECIMAL = 9_999.99;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateManualFoodDto {
  @ApiProperty({ example: 'Arroz integral cozido', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    example: '7891234567890',
    nullable: true,
    description: 'GTIN-8, UPC-A, EAN-13 ou GTIN-14',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{8}|\d{12,14})$/, {
    message: 'barcode must contain 8, 12, 13 or 14 digits',
  })
  barcode?: string | null;

  @ApiProperty({ example: 124, minimum: 0, maximum: MAX_DATABASE_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DATABASE_DECIMAL)
  caloriesPer100g!: number;

  @ApiProperty({ example: 2.6, minimum: 0, maximum: MAX_DATABASE_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DATABASE_DECIMAL)
  proteinPer100g!: number;

  @ApiProperty({ example: 25.8, minimum: 0, maximum: MAX_DATABASE_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DATABASE_DECIMAL)
  carbsPer100g!: number;

  @ApiProperty({ example: 1, minimum: 0, maximum: MAX_DATABASE_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DATABASE_DECIMAL)
  fatPer100g!: number;

  @ApiPropertyOptional({
    example: 2.7,
    default: 0,
    minimum: 0,
    maximum: MAX_DATABASE_DECIMAL,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DATABASE_DECIMAL)
  fiberPer100g = 0;

  @ApiPropertyOptional({
    example: 100,
    default: 100,
    minimum: 0.01,
    maximum: MAX_DATABASE_DECIMAL,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DATABASE_DECIMAL)
  servingSizeG = 100;
}
