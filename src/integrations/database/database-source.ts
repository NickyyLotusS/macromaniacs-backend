import { DataSource } from 'typeorm';
import type { TableColumn } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import type { DataSourceOptions } from 'typeorm';

class PreservedPostgresDriver extends PostgresDriver {
  override findChangedColumns(
    columns: TableColumn[],
    metadata: ColumnMetadata[],
  ): ColumnMetadata[] {
    const canonical = columns.map((column) => {
      if (column.default !== 'CURRENT_TIMESTAMP') return column;
      const copy = column.clone();
      copy.default = 'current_timestamp';
      return copy;
    });
    return super.findChangedColumns(canonical, metadata);
  }
  protected override normalizeDatetimeFunction(value: string): string {
    return value.trim().toUpperCase() === 'CURRENT_TIMESTAMP'
      ? 'CURRENT_TIMESTAMP'
      : super.normalizeDatetimeFunction(value);
  }
}

/** TypeORM 1.1.1 otherwise rewrites PostgreSQL CURRENT_TIMESTAMP defaults to now(). */
export class DatabaseSource extends DataSource {
  constructor(options: DataSourceOptions) {
    super(options);
    if (!(this.driver instanceof PostgresDriver))
      throw new Error('Somente PostgreSQL é permitido.');
    this.driver = new PreservedPostgresDriver(this);
  }
}
