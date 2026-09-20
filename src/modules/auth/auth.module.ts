import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasherService } from '../../shared/security/password-hasher.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserProfile } from './entities/user-profile.entity';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, UserProfile]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            config.getOrThrow<string>('JWT_EXPIRES_IN') as NonNullable<
              JwtModuleOptions['signOptions']
            >['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PasswordHasherService],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
