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
import { CosmeticType } from '../enums';
import type { UserCosmetic } from '../gamification/user-cosmetic.entity';

@Check(
  'cosmetic_items_code_check',
  "((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)",
)
@Check(
  'cosmetic_items_name_not_blank_check',
  '(length(btrim((name)::text)) > 0)',
)
@Check('cosmetic_items_price_check', '(price >= 0)')
@Check(
  'cosmetic_items_asset_url_check',
  '(length(btrim((asset_url)::text)) > 0)',
)
@Index('cosmetic_items_code_key', ['code'], { unique: true })
@Entity('cosmetic_items')
export class CosmeticItem {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'cosmetic_items_pkey',
  })
  id!: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'type',
    type: 'enum',
    enum: CosmeticType,
    enumName: 'CosmeticType',
  })
  type!: CosmeticType;

  @Column({ name: 'price', type: 'integer' })
  price!: number;

  @Column({ name: 'asset_url', type: 'varchar', length: 500 })
  assetUrl!: string;

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

  @OneToMany('UserCosmetic', 'cosmeticItem')
  users!: Relation<UserCosmetic>[];
}
