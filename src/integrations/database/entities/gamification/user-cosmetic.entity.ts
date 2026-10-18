import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { User } from '../identity/user.entity';
import type { CosmeticItem } from '../catalogs/cosmetic-item.entity';

@Index('user_cosmetics_cosmetic_item_id_idx', ['cosmeticItemId'])
@Entity('user_cosmetics')
export class UserCosmetic {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_cosmetics_pkey',
  })
  userId!: string;

  @PrimaryColumn({
    name: 'cosmetic_item_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_cosmetics_pkey',
  })
  cosmeticItemId!: string;

  @Column({
    name: 'acquired_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  acquiredAt!: Date;

  @ManyToOne('User', 'cosmetics', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_cosmetics_user_id_fkey',
  })
  user!: Relation<User>;

  @ManyToOne('CosmeticItem', 'users', {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'cosmetic_item_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_cosmetics_cosmetic_item_id_fkey',
  })
  cosmeticItem!: Relation<CosmeticItem>;
}
