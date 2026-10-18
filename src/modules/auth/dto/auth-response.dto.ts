import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: false })
  onboardingCompleted!: boolean;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'macro_user' })
  username!: string;

  @ApiProperty({ example: 'Macro User' })
  displayName!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({
    type: () => UserProfileResponseDto,
    nullable: true,
    description: 'Ausente até a conclusão do onboarding nutricional',
  })
  profile!: UserProfileResponseDto | null;
}

export class AccessTokenResponseDto {
  @ApiProperty({ description: 'JWT de acesso com expiração configurável' })
  accessToken!: string;
}
