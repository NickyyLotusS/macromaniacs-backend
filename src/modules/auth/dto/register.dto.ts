import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 254 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'macro_user',
    minLength: 3,
    maxLength: 30,
    pattern: '^[a-zA-Z0-9_]+$',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must contain only letters, numbers and underscore',
  })
  username!: string;

  @ApiProperty({
    description: 'Senha entre 8 e 128 caracteres',
    minLength: 8,
    maxLength: 128,
    example: 'a-strong-password',
    writeOnly: true,
  })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiProperty({
    description: 'Confirmação explícita do aceite dos termos',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'termsAccepted must be true' })
  termsAccepted!: true;
}
