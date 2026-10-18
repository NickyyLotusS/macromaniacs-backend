import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MemberRole } from '../enums';
import type { Group } from '../social/group.entity';
import type { User } from '../identity/user.entity';

@Index('group_members_user_id_idx', ['userId'])
@Entity('group_members')
export class GroupMember {
  @PrimaryColumn({
    name: 'group_id',
    type: 'uuid',
    primaryKeyConstraintName: 'group_members_pkey',
  })
  groupId!: string;

  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'group_members_pkey',
  })
  userId!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: MemberRole,
    enumName: 'MemberRole',
    default: MemberRole.MEMBER,
  })
  role!: MemberRole;

  @Column({
    name: 'joined_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt!: Date;

  @ManyToOne('Group', 'members', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'group_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'group_members_group_id_fkey',
  })
  group!: Relation<Group>;

  @ManyToOne('User', 'groupMemberships', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'group_members_user_id_fkey',
  })
  user!: Relation<User>;
}
