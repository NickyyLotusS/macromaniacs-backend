import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { numericTransformer } from './numeric.transformer';

@Entity({ name: 'body_measurements' })
@Index('IDX_body_measurements_user_measured_at', ['userId', 'measuredAt'])
export class BodyMeasurement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({
    name: 'height_cm',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  heightCm!: number;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericTransformer,
  })
  weightKg!: number;

  @Column({ name: 'measured_at', type: 'timestamptz' })
  measuredAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
