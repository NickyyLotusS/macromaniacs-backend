import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  MemberRole,
  ReactionType,
} from '../../../integrations/database/entities/enums';
import { PaginationMetaDto } from '../../../shared/http/pagination.dto';

export class CreateGroupDto {
  @ApiProperty({ example: 'Equipe Macro' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPrivate = true;
}

export class JoinGroupDto {
  @ApiProperty({ example: 'A1B2C3D4' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9]{8}$/)
  inviteCode!: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: MemberRole })
  @IsEnum(MemberRole)
  role!: MemberRole;
}

export class CreateFeedPostDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 2000 })
  @ValidateIf((value: CreateFeedPostDto) => !value.mealLogId)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((value: CreateFeedPostDto) => !value.content)
  @IsUUID()
  mealLogId?: string;
}

export class ReactToPostDto {
  @ApiProperty({ enum: ReactionType })
  @IsEnum(ReactionType)
  reactionType!: ReactionType;
}

export class GroupResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isPrivate!: boolean;
  @ApiProperty({ enum: MemberRole }) role!: MemberRole;
  @ApiProperty({ example: 'A1B2C3D4' }) inviteCode!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class FeedPostResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) groupId!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mealLogId!: string | null;
  @ApiPropertyOptional({ nullable: true }) content!: string | null;
  @ApiProperty() reactions!: Record<ReactionType, number>;
  @ApiPropertyOptional({ enum: ReactionType, nullable: true })
  viewerReaction!: ReactionType | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedPostResponseDto] })
  items!: FeedPostResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class RankingEntryDto {
  @ApiProperty() position!: number;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() username!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() points!: number;
}
