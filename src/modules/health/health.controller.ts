import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { DatabaseHealth } from '../../shared/database/database-health';
import { DATABASE_HEALTH } from '../../shared/database/database-health';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    @Inject(DATABASE_HEALTH) private readonly database: DatabaseHealth,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Verificar a disponibilidade da aplicação' })
  @ApiOkResponse({
    description: 'A aplicação está disponível',
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
  @Get('ready')
  @ApiOperation({ summary: 'Verificar a disponibilidade do PostgreSQL' })
  @ApiOkResponse({
    description: 'A aplicação e o PostgreSQL estão disponíveis',
    schema: { example: { status: 'ok', database: 'ok' } },
  })
  @ApiServiceUnavailableResponse({
    description: 'O PostgreSQL não está disponível',
  })
  async ready() {
    if (!(await this.database.isAvailable())) {
      throw new ServiceUnavailableException('PostgreSQL indisponível');
    }
    return { status: 'ok', database: 'ok' };
  }
}
