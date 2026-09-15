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
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { GroupChallengeStatus } from '../enums';
import type { Group } from '../social/group.entity';

@Check(
  'group_challenges_title_not_blank_check',
  '(length(btrim((title)::text)) > 0)',
)
@Check('group_challenges_date_range_check', '(end_at > start_at)')
@Index('group_challenges_group_id_status_start_at_idx', [
  'groupId',
  'status',
  'startAt',
])
@Entity('group_challenges')
export class GroupChallenge {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'group_challenges_pkey',
  })
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: GroupChallengeStatus,
    enumName: 'GroupChallengeStatus',
    default: GroupChallengeStatus.SCHEDULED,
  })
  status!: GroupChallengeStatus;

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

  @ManyToOne('Group', 'challenges', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'group_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'group_challenges_group_id_fkey',
  })
  group!: Relation<Group>;
}
