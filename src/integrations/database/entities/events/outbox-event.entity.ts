import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { randomUUID } from 'node:crypto';

@Check(
  'outbox_events_payload_check',
  "(jsonb_typeof(payload) = 'object'::text)",
)
@Check('outbox_events_attempts_check', '(attempts >= 0)')
@Index('outbox_events_deduplication_key_key', ['deduplicationKey'], {
  unique: true,
})
@Index('outbox_events_unprocessed_idx', ['occurredAt'], {
  where: 'processed_at IS NULL',
})
@Entity('outbox_events')
export class OutboxEvent {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'outbox_events_pkey',
  })
  id!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'deduplication_key', type: 'varchar', length: 180 })
  deduplicationKey!: string;

  @Column({ name: 'payload', type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @CreateDateColumn({
    name: 'occurred_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  occurredAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }
}
