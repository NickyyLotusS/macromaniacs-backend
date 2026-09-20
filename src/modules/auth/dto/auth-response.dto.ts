import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ example: true })
  termsAccepted!: boolean;

  @ApiProperty({ format: 'date-time' })
  termsAcceptedAt!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: () => UserProfileResponseDto })
  profile!: UserProfileResponseDto;
}

export class AccessTokenResponseDto {
  @ApiProperty({ description: 'JWT de acesso com expiração configurável' })
  accessToken!: string;
}
