import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail ou username',
    example: 'user@example.com',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(3, 254)
  identifier!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'a-strong-password',
    writeOnly: true,
  })
  @IsString()
  @Length(8, 128)
  password!: string;
}
