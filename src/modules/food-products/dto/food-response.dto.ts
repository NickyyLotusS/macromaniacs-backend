import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodSource } from '../../../integrations/database/entities/enums';
import type { FoodRecord } from '../domain/food-catalog';

export class FoodResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Arroz integral cozido' })
  name!: string;

  @ApiProperty({ enum: FoodSource })
  source!: FoodSource;

  @ApiPropertyOptional({ nullable: true, example: '123456' })
  externalId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '7891234567890' })
  barcode!: string | null;

  @ApiProperty({ example: 124 })
  caloriesPer100g!: number;

  @ApiProperty({ example: 2.6 })
  proteinPer100g!: number;

  @ApiProperty({ example: 25.8 })
  carbsPer100g!: number;

  @ApiProperty({ example: 1 })
  fatPer100g!: number;

  @ApiProperty({ example: 2.7 })
  fiberPer100g!: number;

  @ApiProperty({ example: 100 })
  servingSizeG!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(record: FoodRecord): FoodResponseDto {
    return {
      id: record.id,
      name: record.name,
      source: record.source,
      externalId: record.externalId,
      barcode: record.barcode,
      caloriesPer100g: Number(record.caloriesPer100g),
      proteinPer100g: Number(record.proteinPer100g),
      carbsPer100g: Number(record.carbsPer100g),
      fatPer100g: Number(record.fatPer100g),
      fiberPer100g: Number(record.fiberPer100g),
      servingSizeG: Number(record.servingSizeG),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
