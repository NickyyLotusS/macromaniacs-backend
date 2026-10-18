import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Estado atual da aplicação',
    example: 'ok',
  })
  status!: 'ok';

  @ApiProperty({
    description: 'Data e hora da verificação',
    example: '2026-09-17T20:00:00.000Z',
    format: 'date-time',
  })
  timestamp!: string;
}
