import {
  BeforeInsert,
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
import { ReactionType } from '../enums';
import type { FeedPost } from '../social/feed-post.entity';
import type { User } from '../identity/user.entity';

@Index('post_reactions_post_id_user_id_key', ['postId', 'userId'], {
  unique: true,
})
@Index('post_reactions_user_id_idx', ['userId'])
@Entity('post_reactions')
export class PostReaction {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'post_reactions_pkey',
  })
  id!: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'reaction_type',
    type: 'enum',
    enum: ReactionType,
    enumName: 'ReactionType',
  })
  reactionType!: ReactionType;

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

  @ManyToOne('FeedPost', 'reactions', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'post_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'post_reactions_post_id_fkey',
  })
  post!: Relation<FeedPost>;

  @ManyToOne('User', 'postReactions', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'post_reactions_user_id_fkey',
  })
  user!: Relation<User>;
}
