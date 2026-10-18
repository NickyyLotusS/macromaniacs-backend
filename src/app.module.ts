import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { validate } from './shared/config/env.validation';
import { DatabaseModule } from './integrations/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { DietPlansModule } from './modules/diet-plans/diet-plans.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
    }),
    DatabaseModule,
    AuthModule,
    DietPlansModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
