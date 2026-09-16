import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { DatabaseHealth } from '../../shared/database/database-health';
import { DATABASE_HEALTH } from '../../shared/database/database-health';

@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    @Inject(DATABASE_HEALTH) private readonly database: DatabaseHealth,
  ) {}
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    if (!(await this.database.isAvailable())) {
      throw new ServiceUnavailableException('PostgreSQL indisponível');
    }
    return { status: 'ok', database: 'ok' };
  }
}
