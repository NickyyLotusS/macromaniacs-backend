import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MealItemInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  foodId!: string;

  @ApiProperty({ example: 150, minimum: 0.01, maximum: 9999.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  amountGrams!: number;
}
