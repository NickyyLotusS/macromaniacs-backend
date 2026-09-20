import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';

@Entity({ name: 'users' })
@Index('UQ_users_email', ['email'], { unique: true })
@Index('UQ_users_username', ['username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ type: 'varchar', length: 30 })
  username!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ name: 'terms_accepted', type: 'boolean' })
  termsAccepted!: boolean;

  @Column({ name: 'terms_accepted_at', type: 'timestamptz' })
  termsAcceptedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => UserProfile, (profile) => profile.user)
  profile?: Relation<UserProfile>;
}
