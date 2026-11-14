import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

export enum AvatarStyle {
  AVATAAARS = 'avataaars',
  ADVENTURER = 'adventurer',
  BIG_SMILE = 'big-smile',
  FUN_EMOJI = 'fun-emoji',
}

export class AvatarConfigDto {
  @ApiProperty({ enum: AvatarStyle, example: AvatarStyle.ADVENTURER })
  @IsEnum(AvatarStyle)
  style!: AvatarStyle;

  @ApiProperty({
    example: 'abc123xyz789',
    minLength: 6,
    maxLength: 32,
    pattern: '^[A-Za-z0-9]+$',
    description: 'Seed aleatória sem dados pessoais',
  })
  @IsString()
  @Length(6, 32)
  @Matches(/^[A-Za-z0-9]+$/)
  seed!: string;
}

export function normalizeAvatarConfig(
  value: Record<string, unknown> | null | undefined,
): AvatarConfigDto | null {
  if (!value || Object.keys(value).length !== 2) return null;

  const { style, seed } = value;
  if (
    !Object.values(AvatarStyle).includes(style as AvatarStyle) ||
    typeof seed !== 'string' ||
    !/^[A-Za-z0-9]{6,32}$/.test(seed)
  ) {
    return null;
  }

  return { style: style as AvatarStyle, seed };
}
