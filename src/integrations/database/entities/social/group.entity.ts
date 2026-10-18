import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { User } from '../identity/user.entity';
import type { GroupMember } from '../social/group-member.entity';
import type { GroupChallenge } from '../social/group-challenge.entity';
import type { FeedPost } from '../social/feed-post.entity';
import type { ChatMessage } from '../social/chat-message.entity';

@Check('groups_name_not_blank_check', '(length(btrim((name)::text)) > 0)')
@Check(
  'groups_invite_code_check',
  "((invite_code)::text ~ '^[A-Z0-9]{8}$'::text)",
)
@Index('groups_creator_id_idx', ['creatorId'])
@Index('groups_invite_code_key', ['inviteCode'], { unique: true })
@Entity('groups')
export class Group {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'groups_pkey',
  })
  id!: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'invite_code', type: 'varchar', length: 8 })
  inviteCode!: string;

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

  @ManyToOne('User', 'createdGroups', {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'creator_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'groups_creator_id_fkey',
  })
  creator!: Relation<User>;

  @OneToMany('GroupMember', 'group')
  members!: Relation<GroupMember>[];

  @OneToMany('GroupChallenge', 'group')
  challenges!: Relation<GroupChallenge>[];

  @OneToMany('FeedPost', 'group')
  feedPosts!: Relation<FeedPost>[];

  @OneToMany('ChatMessage', 'group')
  messages!: Relation<ChatMessage>[];
}
