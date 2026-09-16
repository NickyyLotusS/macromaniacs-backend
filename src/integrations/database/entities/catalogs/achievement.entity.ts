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
import type { UserAchievement } from '../gamification/user-achievement.entity';

@Check('achievements_code_check', "((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)")
@Check(
  'achievements_title_not_blank_check',
  '(length(btrim((title)::text)) > 0)',
)
@Index('achievements_code_key', ['code'], { unique: true })
@Entity('achievements')
export class Achievement {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'achievements_pkey',
  })
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'title', type: 'varchar', length: 100 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string | null;

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

  @OneToMany('UserAchievement', 'achievement')
  users!: Relation<UserAchievement>[];
}
