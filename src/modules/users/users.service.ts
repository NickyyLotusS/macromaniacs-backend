import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  ActivityLevel as DatabaseActivityLevel,
  BiologicalSex as DatabaseBiologicalSex,
  UserGoal,
} from '../../integrations/database/entities/enums';
import { BodyMeasurement } from '../../integrations/database/entities/identity/body-measurement.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { User } from '../../integrations/database/entities/identity/user.entity';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from './domain/profile.enums';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type {
  BodyMeasurementResponseDto,
  MyProfileResponseDto,
  NutritionMetricsResponseDto,
} from './dto/user-profile-response.dto';
import { NutritionCalculatorService } from './nutrition-calculator.service';
import { assertIanaTimezone } from '../../shared/time/timezone';

type PostgresDriverError = { code?: string };

const apiGoalToDatabase: Readonly<Record<NutritionGoal, UserGoal>> = {
  [NutritionGoal.LOSE_WEIGHT]: UserGoal.WEIGHT_LOSS,
  [NutritionGoal.GAIN_MUSCLE]: UserGoal.MUSCLE_GAIN,
  [NutritionGoal.GAIN_STRENGTH]: UserGoal.STRENGTH_GAIN,
  [NutritionGoal.MAINTAIN]: UserGoal.MAINTENANCE,
  [NutritionGoal.RECOMPOSITION]: UserGoal.RECOMPOSITION,
  [NutritionGoal.PERFORMANCE]: UserGoal.PERFORMANCE,
};

const databaseGoalToApi = new Map<UserGoal, NutritionGoal>(
  Object.entries(apiGoalToDatabase).map(([api, database]) => [
    database,
    api as NutritionGoal,
  ]),
);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(BodyMeasurement)
    private readonly measurements: Repository<BodyMeasurement>,
    private readonly dataSource: DataSource,
    private readonly calculator: NutritionCalculatorService,
  ) {}

  async getMe(userId: string): Promise<MyProfileResponseDto> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const measurements = user.profile
      ? await this.measurements.find({
          where: { userId },
          order: { measuredAt: 'DESC' },
        })
      : [];

    return this.toResponse(user, user.profile ?? null, measurements);
  }

  async updateMe(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<MyProfileResponseDto> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          relations: { profile: true },
        });

        if (!user) {
          throw new UnauthorizedException('Invalid or expired token');
        }

        if (dto.username !== undefined && dto.username !== user.username) {
          const duplicate = await manager.findOneBy(User, {
            username: dto.username,
          });
          if (duplicate) {
            throw new ConflictException('username already exists');
          }
          user.username = dto.username;
        }
        if (dto.displayName !== undefined) user.displayName = dto.displayName;
        await manager.save(User, user);

        let profile = user.profile ?? null;
        if (!profile && this.hasProfileFields(dto)) {
          profile = await this.createEmptyProfile(manager, userId);
        }
        if (profile) {
          await this.updateProfile(manager, profile, dto);
        }
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as PostgresDriverError).code === '23505'
      ) {
        throw new ConflictException('username already exists');
      }
      throw error;
    }

    return this.getMe(userId);
  }

  private createEmptyProfile(
    manager: EntityManager,
    userId: string,
  ): Promise<UserProfile> {
    return manager.save(
      UserProfile,
      manager.create(UserProfile, {
        userId,
        birthDate: null,
        biologicalSex: null,
        heightCm: null,
        currentWeightKg: null,
        targetWeightKg: null,
        targetDate: null,
        dietaryRestrictionsNote: null,
        goal: null,
        activityLevel: null,
        timezone: 'UTC',
        onboardingCompletedAt: null,
        avatarConfig: {},
      }),
    );
  }

  private async updateProfile(
    manager: EntityManager,
    profile: UserProfile,
    dto: UpdateMyProfileDto,
  ): Promise<void> {
    const wasComplete = profile.onboardingCompletedAt !== null;
    const previousWeight = profile.currentWeightKg;
    if (dto.dateOfBirth !== undefined) profile.birthDate = dto.dateOfBirth;
    if (dto.biologicalSex !== undefined) {
      profile.biologicalSex =
        dto.biologicalSex as unknown as DatabaseBiologicalSex;
    }
    if (dto.goal !== undefined) profile.goal = apiGoalToDatabase[dto.goal];
    if (dto.activityLevel !== undefined) {
      profile.activityLevel =
        dto.activityLevel as unknown as DatabaseActivityLevel;
    }
    if (dto.heightCm !== undefined) {
      profile.heightCm = this.decimal(dto.heightCm);
    }
    if (dto.currentWeightKg !== undefined) {
      profile.currentWeightKg = this.decimal(dto.currentWeightKg);
    }
    if (dto.targetWeightKg !== undefined) {
      profile.targetWeightKg =
        dto.targetWeightKg === null ? null : this.decimal(dto.targetWeightKg);
    }
    if (dto.targetDate !== undefined) profile.targetDate = dto.targetDate;
    if (dto.dietaryRestrictions !== undefined) {
      profile.dietaryRestrictionsNote = dto.dietaryRestrictions;
    }
    if (dto.timezone !== undefined) {
      try {
        profile.timezone = assertIanaTimezone(dto.timezone);
      } catch {
        throw new BadRequestException('timezone must be a valid IANA timezone');
      }
    }

    this.validateGoalDetails(profile.targetWeightKg, profile.targetDate);
    const missing = this.missingOnboardingFields(profile);
    if (!wasComplete && missing.length > 0 && this.hasOnboardingFields(dto)) {
      throw new BadRequestException(
        `Complete o primeiro perfil com: ${missing.join(', ')}`,
      );
    }

    if (missing.length === 0) {
      this.calculateNutrition(profile);
      if (!wasComplete) {
        profile.onboardingCompletedAt = new Date();
        await this.addMeasurement(
          manager,
          profile.userId,
          Number(profile.currentWeightKg),
        );
      } else if (
        dto.currentWeightKg !== undefined &&
        Number(previousWeight) !== dto.currentWeightKg
      ) {
        await this.addMeasurement(manager, profile.userId, dto.currentWeightKg);
      }
    }
    await manager.save(UserProfile, profile);
  }

  private addMeasurement(
    manager: EntityManager,
    userId: string,
    weightKg: number,
  ): Promise<BodyMeasurement> {
    return manager.save(
      BodyMeasurement,
      manager.create(BodyMeasurement, {
        userId,
        weightKg: this.decimal(weightKg),
        measuredAt: new Date(),
      }),
    );
  }

  private hasProfileFields(dto: UpdateMyProfileDto): boolean {
    return [
      dto.dateOfBirth,
      dto.biologicalSex,
      dto.goal,
      dto.activityLevel,
      dto.heightCm,
      dto.currentWeightKg,
      dto.targetWeightKg,
      dto.targetDate,
      dto.dietaryRestrictions,
      dto.timezone,
    ].some((value) => value !== undefined);
  }

  private hasOnboardingFields(dto: UpdateMyProfileDto): boolean {
    return [
      dto.dateOfBirth,
      dto.biologicalSex,
      dto.goal,
      dto.activityLevel,
      dto.heightCm,
      dto.currentWeightKg,
      dto.targetWeightKg,
      dto.targetDate,
      dto.dietaryRestrictions,
    ].some((value) => value !== undefined);
  }

  private missingOnboardingFields(profile: UserProfile): string[] {
    return [
      ['dateOfBirth', profile.birthDate],
      ['biologicalSex', profile.biologicalSex],
      ['goal', profile.goal],
      ['activityLevel', profile.activityLevel],
      ['heightCm', profile.heightCm],
      ['currentWeightKg', profile.currentWeightKg],
    ]
      .filter(([, value]) => value === null || value === undefined)
      .map(([field]) => String(field));
  }

  private validateGoalDetails(
    targetWeightKg: string | number | null,
    targetDate: string | null,
  ): void {
    if ((targetWeightKg === null) !== (targetDate === null)) {
      throw new BadRequestException(
        'targetWeightKg and targetDate must be provided together',
      );
    }
  }

  private toResponse(
    user: User,
    profile: UserProfile | null,
    measurements: BodyMeasurement[],
  ): MyProfileResponseDto {
    if (!profile || profile.onboardingCompletedAt === null) {
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        dateOfBirth: null,
        biologicalSex: null,
        goal: null,
        activityLevel: null,
        targetWeightKg: null,
        targetDate: null,
        dietaryRestrictions: null,
        timezone: profile?.timezone ?? 'UTC',
        onboardingCompleted: false,
        onboardingCompletedAt: null,
        currentMeasurement: null,
        measurements: [],
        nutrition: null,
      };
    }

    const measurementResponses = measurements.map((measurement) =>
      this.toMeasurementResponse(profile, measurement),
    );

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      dateOfBirth: profile.birthDate,
      biologicalSex: this.toApiSex(profile.biologicalSex),
      goal: profile.goal ? (databaseGoalToApi.get(profile.goal) ?? null) : null,
      activityLevel: profile.activityLevel as unknown as ActivityLevel,
      targetWeightKg:
        profile.targetWeightKg === null ? null : Number(profile.targetWeightKg),
      targetDate: profile.targetDate,
      dietaryRestrictions: profile.dietaryRestrictionsNote,
      timezone: profile.timezone,
      onboardingCompleted: true,
      onboardingCompletedAt: profile.onboardingCompletedAt.toISOString(),
      currentMeasurement: measurementResponses[0] ?? null,
      measurements: measurementResponses,
      nutrition: this.toNutritionResponse(profile),
    };
  }

  private toMeasurementResponse(
    profile: UserProfile,
    measurement: BodyMeasurement,
  ): BodyMeasurementResponseDto {
    return {
      id: measurement.id,
      heightCm: Number(profile.heightCm),
      weightKg: Number(measurement.weightKg),
      measuredAt: measurement.measuredAt.toISOString(),
    };
  }

  private toNutritionResponse(
    profile: UserProfile,
  ): NutritionMetricsResponseDto | null {
    const calculation = this.calculateNutrition(profile);
    if (!calculation) return null;
    return {
      ...calculation,
      calculatedAt: profile.updatedAt.toISOString(),
    };
  }

  private calculateNutrition(profile: UserProfile) {
    const biologicalSex = this.toApiSex(profile.biologicalSex);
    const goal = profile.goal ? databaseGoalToApi.get(profile.goal) : undefined;
    if (
      !biologicalSex ||
      biologicalSex === BiologicalSex.NOT_INFORMED ||
      !goal ||
      !profile.birthDate ||
      !profile.heightCm ||
      !profile.currentWeightKg ||
      !profile.activityLevel
    ) {
      return null;
    }
    return this.calculator.calculate({
      dateOfBirth: profile.birthDate,
      biologicalSex,
      heightCm: Number(profile.heightCm),
      currentWeightKg: Number(profile.currentWeightKg),
      goal,
      activityLevel: profile.activityLevel as unknown as ActivityLevel,
      targetWeightKg:
        profile.targetWeightKg === null ? null : Number(profile.targetWeightKg),
      targetDate: profile.targetDate,
    });
  }

  private toApiSex(value: DatabaseBiologicalSex | null): BiologicalSex | null {
    if (value === DatabaseBiologicalSex.MALE) return BiologicalSex.MALE;
    if (value === DatabaseBiologicalSex.FEMALE) return BiologicalSex.FEMALE;
    if (value === DatabaseBiologicalSex.NOT_INFORMED) {
      return BiologicalSex.NOT_INFORMED;
    }
    return null;
  }

  private decimal(value: number): string {
    return value.toFixed(2);
  }
}
