import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DatabaseHealth } from '../../shared/database/database-health';

@Injectable()
export class DatabaseHealthAdapter implements DatabaseHealth {
  constructor(private readonly dataSource: DataSource) {}
  async isAvailable(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
