import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { User } from '../../integrations/database/entities/identity/user.entity';
import { PasswordHasherService } from '../../shared/security/password-hasher.service';
import type {
  AccessTokenResponseDto,
  AuthenticatedUserResponseDto,
} from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

type PostgresDriverError = {
  code?: string;
  constraint?: string;
};

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
  ) {
    this.dummyPasswordHash = this.passwordHasher.hash(
      'constant-dummy-password-for-timing-only',
    );
  }

  async register(dto: RegisterDto): Promise<AuthenticatedUserResponseDto> {
    const existingUser = await this.users.findOne({
      where: [{ email: dto.email }, { username: dto.username }],
    });

    if (existingUser) {
      this.throwDuplicate(
        existingUser.email === dto.email ? 'email' : 'username',
      );
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = manager.create(User, {
          email: dto.email,
          username: dto.username,
          displayName: dto.username,
          passwordHash,
        });
        const savedUser = await manager.save(User, user);
        return this.toResponse(savedUser, null);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const constraint = this.getConstraint(error);
        this.throwDuplicate(
          constraint?.includes('username') ? 'username' : 'email',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AccessTokenResponseDto> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :identifier OR user.username = :identifier', {
        identifier: dto.identifier,
      })
      .getOne();

    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordMatches = await this.passwordHasher.verify(
      dto.password,
      passwordHash,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id }),
    };
  }

  async me(userId: string): Promise<AuthenticatedUserResponseDto> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return this.toResponse(user, user.profile ?? null);
  }

  private toResponse(
    user: User,
    profile: UserProfile | null,
  ): AuthenticatedUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      profile: profile
        ? { id: profile.userId, onboardingCompleted: true }
        : null,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as PostgresDriverError).code === '23505'
    );
  }

  private getConstraint(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) {
      return undefined;
    }

    return (error.driverError as PostgresDriverError).constraint;
  }

  private throwDuplicate(field: 'email' | 'username'): never {
    throw new ConflictException(`${field} already exists`);
  }
}
