import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CosmeticType } from '../../../integrations/database/entities/enums';

export class RewardItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: CosmeticType }) type!: CosmeticType;
  @ApiProperty() price!: number;
  @ApiProperty() assetUrl!: string;
}

export class InventoryItemDto extends RewardItemDto {
  @ApiProperty({ format: 'date-time' }) acquiredAt!: string;
  @ApiProperty() isEquipped!: boolean;
}

export class PointsBalanceDto {
  @ApiProperty() balance!: number;
}

export class PurchaseResponseDto {
  @ApiProperty({ type: InventoryItemDto }) item!: InventoryItemDto;
  @ApiProperty() balance!: number;
}
