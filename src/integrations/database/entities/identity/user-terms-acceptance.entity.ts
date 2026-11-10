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
import type { User } from './user.entity';

@Check(
  'user_terms_acceptances_version_not_blank_check',
  '(length(btrim((terms_version)::text)) > 0)',
)
@Index(
  'user_terms_acceptances_user_id_terms_version_key',
  ['userId', 'termsVersion'],
  { unique: true },
)
@Entity('user_terms_acceptances')
export class UserTermsAcceptance {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_terms_acceptances_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'terms_version', type: 'varchar', length: 64 })
  termsVersion!: string;

  @CreateDateColumn({
    name: 'accepted_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  acceptedAt!: Date;

  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @ManyToOne('User', 'termsAcceptances', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_terms_acceptances_user_id_fkey',
  })
  user!: Relation<User>;
}
