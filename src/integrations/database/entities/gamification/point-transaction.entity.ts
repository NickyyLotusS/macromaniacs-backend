import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PointTransactionReason } from '../enums';
import type { User } from '../identity/user.entity';

@Check('point_transactions_amount_check', '(amount <> 0)')
@Check(
  'point_transactions_metadata_check',
  "(jsonb_typeof(metadata) = 'object'::text)",
)
@Index('point_transactions_user_id_created_at_idx', { synchronize: false })
@Entity('point_transactions')
export class PointTransaction {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'point_transactions_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'amount', type: 'integer' })
  amount!: number;

  @Column({
    name: 'reason',
    type: 'enum',
    enum: PointTransactionReason,
    enumName: 'PointTransactionReason',
  })
  reason!: PointTransactionReason;

  @Column({ name: 'metadata', type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  // UUIDs remain application-generated: the existing PostgreSQL columns have no default.
  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @ManyToOne('User', 'pointTransactions', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'point_transactions_user_id_fkey',
  })
  user!: Relation<User>;
}
