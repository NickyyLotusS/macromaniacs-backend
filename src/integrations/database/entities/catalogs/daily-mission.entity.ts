import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { UserDailyMission } from '../gamification/user-daily-mission.entity';

@Check(
  'daily_missions_code_check',
  "((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)",
)
@Check(
  'daily_missions_title_not_blank_check',
  '(length(btrim((title)::text)) > 0)',
)
@Check('daily_missions_target_count_check', '(target_count > 0)')
@Check('daily_missions_points_reward_check', '(points_reward >= 0)')
@Index('daily_missions_code_key', ['code'], { unique: true })
@Entity('daily_missions')
export class DailyMission {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'daily_missions_pkey',
  })
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'target_count', type: 'integer', default: 1 })
  targetCount!: number;

  @Column({ name: 'points_reward', type: 'integer' })
  pointsReward!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  // UUIDs remain application-generated: the existing PostgreSQL columns have no default.
  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @OneToMany('UserDailyMission', 'mission')
  users!: Relation<UserDailyMission>[];
}
