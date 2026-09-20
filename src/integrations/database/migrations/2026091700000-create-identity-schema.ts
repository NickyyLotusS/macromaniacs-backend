import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentitySchema2026091700000
  implements MigrationInterface
{
  name = 'CreateIdentitySchema2026091700000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" varchar(254) NOT NULL,
        "username" varchar(30) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "terms_accepted" boolean NOT NULL,
        "terms_accepted_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "CHK_users_email_normalized" CHECK ("email" = lower("email")),
        CONSTRAINT "CHK_users_username_normalized" CHECK ("username" = lower("username"))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_user_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_profiles"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
