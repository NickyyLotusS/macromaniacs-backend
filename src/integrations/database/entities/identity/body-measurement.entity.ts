import {
  BeforeInsert,
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { User } from '../identity/user.entity';

@Check('body_measurements_weight_kg_check', '(weight_kg > (0)::numeric)')
@Index('body_measurements_user_id_measured_at_idx', { synchronize: false })
@Entity('body_measurements')
export class BodyMeasurement {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'body_measurements_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 5, scale: 2 })
  weightKg!: string;

  @Column({
    name: 'measured_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  measuredAt!: Date;

  // UUIDs remain application-generated: the existing PostgreSQL columns have no default.
  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @ManyToOne('User', 'measurements', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'body_measurements_user_id_fkey',
  })
  user!: Relation<User>;
}
