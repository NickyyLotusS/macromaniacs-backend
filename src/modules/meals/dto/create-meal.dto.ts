import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealItemInputDto } from './meal-item.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateManualMealDto {
  @ApiProperty({ example: 'Almoço', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  consumedAt?: string;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  photoUrl?: string | null;

  @ApiProperty({ type: [MealItemInputDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MealItemInputDto)
  items!: MealItemInputDto[];
}

export class CheckInPlannedMealDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  plannedMealId!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  consumedAt?: string;
}
